-- A validated command boundary. No client can directly insert registrations, roles or messages.
create function public.community_action(kind text, p jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare uid uuid:=require_student(); target uuid:=nullif(p->>'id','')::uuid; result uuid:=gen_random_uuid(); sid uuid:=nullif(p->>'session_id','')::uuid; cid uuid:=nullif(p->>'circle_id','')::uuid; q session_questions; m session_messages; req session_requests; doubt instant_doubt_requests; proposal host_proposals; begin
 perform throttle(case when kind='report' then 'reports' else 'community' end,case when kind='report' then 10 else 100 end);
 if kind in ('message','question') then
   if not member_of(sid) then raise exception 'Approved registration required'; end if;
   if kind='message' then
     if nullif(p->>'parent_id','') is not null and not exists(select 1 from session_messages where id=(p->>'parent_id')::uuid and session_id=sid) then raise exception 'Reply must belong to this session'; end if;
     if coalesce((p->>'announcement')::boolean,false) and not exists(select 1 from sessions where id=sid and host_id=uid) then raise exception 'Only hosts can post announcements'; end if;
     insert into session_messages(id,session_id,user_id,body,parent_id,announcement) values(result,sid,uid,p->>'body',nullif(p->>'parent_id','')::uuid,coalesce((p->>'announcement')::boolean,false));
     if nullif(p->>'parent_id','') is not null then perform notify(user_id,'reply_received','Someone replied to your message','/sessions/'||sid) from session_messages where id=(p->>'parent_id')::uuid and user_id<>uid and not blocked(user_id); end if;
   else insert into session_questions(id,session_id,user_id,body) values(result,sid,uid,p->>'body'); end if;
 elsif kind in ('edit_message','delete_message','react') then
   select * into m from session_messages where id=target;
   if m.id is null or not member_of(m.session_id) then raise exception 'Message unavailable'; end if;
   if kind='react' then if exists(select 1 from message_reactions where message_id=target and user_id=uid) then delete from message_reactions where message_id=target and user_id=uid; else insert into message_reactions values(target,uid); end if;
   elsif kind='edit_message' and m.user_id=uid then update session_messages set body=p->>'body',edited_at=now() where id=target;
   elsif kind='delete_message' and (m.user_id=uid or exists(select 1 from sessions where id=m.session_id and host_id=uid) or is_staff()) then delete from session_messages where id=target;
   else raise exception 'Not authorized'; end if;
 elsif kind in ('vote','answer','resolve','pin') then
   select * into q from session_questions where id=target;
   if q.id is null or not member_of(q.session_id) then raise exception 'Question unavailable'; end if;
   if kind='vote' then if exists(select 1 from question_votes where question_id=target and user_id=uid) then delete from question_votes where question_id=target and user_id=uid; else insert into question_votes values(target,uid); end if;
   elsif kind='resolve' and (q.user_id=uid or exists(select 1 from sessions where id=q.session_id and host_id=uid)) then update session_questions set resolved=not resolved where id=target;
   elsif exists(select 1 from sessions where id=q.session_id and host_id=uid) then
     if kind='answer' then update session_questions set answer=p->>'body',resolved=true where id=target; perform notify(q.user_id,'question_answered','Your question has an answer','/sessions/'||q.session_id);
     elsif kind='pin' then update session_questions set pinned=not pinned where id=target; else raise exception 'Invalid question action'; end if;
   else raise exception 'Host or question owner required'; end if;
 elsif kind='request' then insert into session_requests(id,creator_id,topic,description,category_id,difficulty,preferred_schedule,language,tags) values(result,uid,p->>'topic',p->>'description',(p->>'category_id')::uuid,p->>'difficulty',p->>'preferred_schedule',p->>'language',p->>'tags');
 elsif kind='interest' then if exists(select 1 from request_interests where request_id=target and user_id=uid) then delete from request_interests where request_id=target and user_id=uid; else insert into request_interests values(target,uid); end if;
 elsif kind='propose' then insert into host_proposals(id,request_id,host_id,note) values(result,target,uid,p->>'body') on conflict(request_id,host_id) do update set note=excluded.note where host_proposals.status='pending';
 elsif kind='accept_proposal' then
   select * into proposal from host_proposals where id=target;
   select * into req from session_requests where id=proposal.request_id for update;
   if req.creator_id is distinct from uid or req.session_id is not null then raise exception 'Only the requester can select a host'; end if;
   if exists(select 1 from host_proposals where request_id=req.id and status='accepted') then raise exception 'A host is already selected'; end if;
   update host_proposals set status=case when id=target then 'accepted' else 'rejected' end where request_id=req.id;
   perform notify(proposal.host_id,'request_accepted','Your proposal was accepted. Create a session and link it to this request.','/requests/'||req.id);
 elsif kind='link_request' then
   select * into req from session_requests where id=target for update;
   if req.session_id is not null or not exists(select 1 from host_proposals where request_id=target and host_id=uid and status='accepted') or not exists(select 1 from sessions where id=sid and host_id=uid and status='published' and visibility='public') then raise exception 'An accepted host must link their published public session'; end if;
   update session_requests set session_id=sid where id=target;
   insert into notifications(user_id,kind,message,href) select user_id,'request_scheduled','A workshop you requested is scheduled','/sessions/'||sid from request_interests where request_id=target and not exists(select 1 from notification_preferences np where np.user_id=request_interests.user_id and muted);
 elsif kind='doubt' then insert into instant_doubt_requests(id,creator_id,topic,subject,description,urgency,expected_minutes,language,difficulty) values(result,uid,p->>'topic',p->>'subject',p->>'description',p->>'urgency',(p->>'expected_minutes')::int,p->>'language',p->>'difficulty');
 elsif kind in ('volunteer','accept_helper','resolve_doubt','cancel_doubt','doubt_link') then
   select * into doubt from instant_doubt_requests where id=target for update;
   if doubt.id is null then raise exception 'Request not found'; end if;
   if kind='volunteer' then if doubt.creator_id=uid or doubt.status<>'pending' or doubt.expires_at<=now() or blocked(doubt.creator_id) then raise exception 'This doubt is no longer accepting volunteers'; end if; insert into doubt_volunteers values(target,uid,now()) on conflict do nothing;
   elsif kind='accept_helper' and doubt.creator_id=uid and doubt.status='pending' and doubt.expires_at>now() and exists(select 1 from doubt_volunteers where doubt_id=target and user_id=(p->>'user_id')::uuid) then update instant_doubt_requests set helper_id=(p->>'user_id')::uuid,status='accepted' where id=target;
   elsif kind='resolve_doubt' and doubt.creator_id=uid and doubt.status='accepted' then update instant_doubt_requests set status='resolved' where id=target;
   elsif kind='cancel_doubt' and doubt.creator_id=uid and doubt.status in ('pending','accepted') then update instant_doubt_requests set status='cancelled' where id=target;
   elsif kind='doubt_link' and uid in (doubt.creator_id,doubt.helper_id) and doubt.status='accepted' and coalesce((p->>'authorized')::boolean,false) and valid_meeting_url(p->>'meeting_url') then insert into doubt_links values(target,p->>'meeting_url') on conflict(doubt_id) do update set meeting_url=excluded.meeting_url;
   else raise exception 'This action is not permitted'; end if;
 elsif kind='circle' then insert into study_circles(id,owner_id,title,description,category_id,rules,membership_mode) values(result,uid,p->>'title',p->>'description',(p->>'category_id')::uuid,p->>'rules',p->>'membership_mode'); insert into circle_memberships values(result,uid,'approved','moderator',now());
 elsif kind='join_circle' then
   if exists(select 1 from circle_memberships where circle_id=target and user_id=uid and status='removed') then raise exception 'Membership removed by moderator'; end if;
   insert into circle_memberships(circle_id,user_id,status) select id,uid,case when membership_mode='open' then 'approved' else 'pending' end from study_circles where id=target on conflict do nothing;
 elsif kind='circle_member' then if not circle_manager(target) or exists(select 1 from study_circles where id=target and owner_id=(p->>'user_id')::uuid) or p->>'status' not in ('approved','removed') then raise exception 'Not authorized'; end if; update circle_memberships set status=p->>'status' where circle_id=target and user_id=(p->>'user_id')::uuid;
 elsif kind='circle_post' then if not circle_member(cid) then raise exception 'Approved circle membership required'; end if; insert into circle_posts(id,circle_id,user_id,body) values(result,cid,uid,p->>'body');
 elsif kind='delete_post' then if not exists(select 1 from circle_posts where id=target and (user_id=uid or circle_manager(circle_id) or is_staff())) then raise exception 'Not authorized'; end if; delete from circle_posts where id=target;
 elsif kind='follow' then if blocked(target) then raise exception 'This connection is unavailable'; end if; if exists(select 1 from follows where follower_id=uid and followed_id=target) then delete from follows where follower_id=uid and followed_id=target; else insert into follows values(uid,target); perform notify(target,'new_follower','A learner followed your profile','/people/'||uid); end if;
 elsif kind='follow_topic' then if exists(select 1 from topic_follows where user_id=uid and category_id=target) then delete from topic_follows where user_id=uid and category_id=target; else insert into topic_follows values(uid,target); end if;
 elsif kind='save' then if not can_view_session(target) then raise exception 'Session unavailable'; end if; if exists(select 1 from saved_sessions where user_id=uid and session_id=target) then delete from saved_sessions where user_id=uid and session_id=target; else insert into saved_sessions values(uid,target); end if;
 elsif kind='review' then
   if not exists(select 1 from sessions s join registrations r on r.session_id=s.id where s.id=target and s.status='published' and s.ends_at<now() and s.host_id<>uid and r.user_id=uid and r.status='approved') then raise exception 'Only approved participants may review completed sessions'; end if;
   insert into host_reviews(session_id,user_id,rating,feedback,relevance,clarity,helpfulness) values(target,uid,(p->>'rating')::int,p->>'body',(p->>'relevance')::int,(p->>'clarity')::int,(p->>'helpfulness')::int);
 elsif kind='report' then
   if not ((p->>'target_type'='session' and can_view_session(target)) or (p->>'target_type'='message' and exists(select 1 from session_messages where id=target and member_of(session_id))) or (p->>'target_type'='profile' and exists(select 1 from profiles where id=target)) or (p->>'target_type'='circle_post' and exists(select 1 from circle_posts where id=target and circle_member(circle_id)))) then raise exception 'Report target unavailable'; end if;
   insert into reports(id,reporter_id,target_type,target_id,reason) values(result,uid,p->>'target_type',target,p->>'body');
 elsif kind='block' then if exists(select 1 from user_blocks where user_id=uid and blocked_id=target) then delete from user_blocks where user_id=uid and blocked_id=target; else insert into user_blocks values(uid,target); delete from follows where (follower_id=uid and followed_id=target) or (follower_id=target and followed_id=uid); end if;
 elsif kind='read_notifications' then update notifications set read_at=now() where user_id=uid and (target is null or id=target);
 elsif kind='mute_notifications' then insert into notification_preferences values(uid,(p->>'muted')::boolean) on conflict(user_id) do update set muted=excluded.muted;
 else raise exception 'Unknown action'; end if;
 return result; end $$;

create function public.doubt_join_details(did uuid) returns text language plpgsql security definer set search_path=public as $$ declare uid uuid:=require_student(); u text; begin if not exists(select 1 from instant_doubt_requests where id=did and status='accepted' and uid in (creator_id,helper_id) and not blocked(creator_id) and not blocked(helper_id)) then raise exception 'Only selected participants may join'; end if; select meeting_url into u from doubt_links where doubt_id=did; if u is null then raise exception 'A participant must share an authorized meeting link first'; end if; return u; end $$;
create function public.moderate(rid uuid, decision text, reason text) returns void language plpgsql security definer set search_path=public as $$ declare uid uuid:=require_student(); r reports; begin
 if not is_staff() or length(reason) not between 5 and 2000 then raise exception 'Moderator access and a reason required'; end if;
 select * into r from reports where id=rid for update; if r.id is null then raise exception 'Report not found'; end if;
 if decision='remove' then
   if r.target_type='session' then update sessions set status='cancelled' where id=r.target_id; update session_links set revoked=true where session_id=r.target_id;
   elsif r.target_type='message' then delete from session_messages where id=r.target_id;
   elsif r.target_type='circle_post' then delete from circle_posts where id=r.target_id;
   else raise exception 'Use suspend for account reports'; end if;
 elsif decision='suspend' and is_admin() and r.target_type='profile' and r.target_id<>uid then update profiles set suspended=true where id=r.target_id;
 elsif decision<>'dismiss' then raise exception 'Administrator access required for suspension'; end if;
 update reports set status='reviewed' where id=rid;
 insert into moderation_actions(actor_id,report_id,action,reason) values(uid,rid,decision,reason);
 insert into audit_logs(actor_id,action,target_id) values(uid,'moderation_'||decision,r.target_id); end $$;
create function public.manage_category(cid uuid, label text, slug_value text, enabled boolean) returns void language plpgsql security definer set search_path=public as $$ begin if not is_admin() or length(label) not between 2 and 80 or slug_value !~ '^[a-z0-9-]{2,80}$' then raise exception 'Administrator access and a valid category required'; end if; insert into categories(id,name,slug,active) values(coalesce(cid,gen_random_uuid()),label,slug_value,enabled) on conflict(id) do update set name=excluded.name,slug=excluded.slug,active=excluded.active; insert into audit_logs(actor_id,action,target_id) values(auth.uid(),'category_saved',cid); end $$;
-- Invoke from a trusted pg_cron job, never an unauthenticated HTTP endpoint.
create table public.reminder_deliveries (session_id uuid references sessions on delete cascade, user_id uuid references profiles on delete cascade, starts_at timestamptz not null, primary key(session_id,user_id,starts_at));
alter table reminder_deliveries enable row level security;
create function public.deliver_reminders() returns void language plpgsql security definer set search_path=public as $$ declare item record; begin
 update instant_doubt_requests set status='expired' where status='pending' and expires_at<=now();
 for item in select s.id,s.title,s.starts_at,r.user_id from sessions s join registrations r on r.session_id=s.id and r.status='approved' where s.status='published' and s.starts_at between now() and now()+interval '30 minutes' loop
 insert into reminder_deliveries values(item.id,item.user_id,item.starts_at) on conflict do nothing;
 if found then perform notify(item.user_id,'session_reminder',item.title||' starts soon','/sessions/'||item.id); end if; end loop;
 delete from rate_events where created_at<now()-interval '2 days'; end $$;
revoke execute on function community_action(text,jsonb),doubt_join_details(uuid),moderate(uuid,text,text),manage_category(uuid,text,text,boolean),deliver_reminders() from public,anon,authenticated;
grant execute on function community_action(text,jsonb),doubt_join_details(uuid),moderate(uuid,text,text),manage_category(uuid,text,text,boolean) to authenticated;
-- Postgres Changes sends only rows that pass the subscriber's RLS SELECT policies.
alter publication supabase_realtime add table session_messages,session_questions,question_votes,notifications,circle_posts,instant_doubt_requests;
