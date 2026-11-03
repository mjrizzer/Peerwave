-- All writes go through narrowly scoped RPCs, except editable profile fields.
create extension if not exists pgcrypto;
create table public.profiles (id uuid primary key references auth.users on delete cascade, display_name text not null default 'New learner' check(length(display_name) between 2 and 70), username text unique check(username ~ '^[a-z0-9_]{3,30}$'), bio text not null default '' check(length(bio)<=1000), interests text not null default '', skills text not null default '', learn text not null default '', teach text not null default '', language text not null default 'English', time_zone text not null default 'UTC', onboarded boolean not null default false, suspended boolean not null default false, created_at timestamptz not null default now());
create table public.profile_academics (user_id uuid primary key references profiles on delete cascade, college text not null default '', course text not null default '', year text not null default '', academic_public boolean not null default false);
create table public.user_roles (user_id uuid references profiles on delete cascade, role text check(role in ('moderator','admin')), primary key(user_id,role));
create table public.categories (id uuid primary key default gen_random_uuid(), name text not null unique, slug text not null unique, active boolean not null default true);
create table public.tags (id uuid primary key default gen_random_uuid(), name text not null unique);
create table public.user_interests (user_id uuid references profiles on delete cascade, category_id uuid references categories on delete cascade, primary key(user_id,category_id));
create table public.study_circles (id uuid primary key default gen_random_uuid(), owner_id uuid not null references profiles, title text not null check(length(title) between 3 and 120), description text not null check(length(description) between 10 and 4000), category_id uuid references categories, rules text not null default 'Be kind. Stay curious. Respect everyone.', membership_mode text not null default 'open' check(membership_mode in ('open','approval')), created_at timestamptz not null default now());
create table public.circle_memberships (circle_id uuid references study_circles on delete cascade, user_id uuid references profiles on delete cascade, status text not null check(status in ('pending','approved','removed')), role text not null default 'member' check(role in ('member','moderator')), created_at timestamptz not null default now(), primary key(circle_id,user_id));
create table public.sessions (id uuid primary key default gen_random_uuid(), host_id uuid not null references profiles, category_id uuid not null references categories, circle_id uuid references study_circles on delete set null, title text not null check(length(title) between 8 and 140), description text not null check(length(description) between 30 and 4000), subject text not null check(length(subject) between 2 and 100), tags text not null default '' check(length(tags)<=200), difficulty text not null check(difficulty in ('Beginner','Intermediate','Advanced')), language text not null default 'English', starts_at timestamptz not null, ends_at timestamptz not null, time_zone text not null default 'UTC', capacity int not null check(capacity between 1 and 500), provider text not null check(provider in ('Google Meet','Zoom','Microsoft Teams')), objectives text not null default '', prerequisites text not null default '', visibility text not null default 'public' check(visibility in ('public','unlisted','private')), registration_mode text not null default 'instant' check(registration_mode in ('instant','approval')), status text not null default 'draft' check(status in ('draft','published','cancelled')), registration_closed boolean not null default false, join_minutes int not null default 15 check(join_minutes between 0 and 1440), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(ends_at>starts_at));
create index sessions_discovery on sessions(status,visibility,starts_at);
create index sessions_host on sessions(host_id);
create table public.session_tags (session_id uuid references sessions on delete cascade, tag_id uuid references tags on delete cascade, primary key(session_id,tag_id));
create table public.session_links (session_id uuid primary key references sessions on delete cascade, meeting_url text not null, revoked boolean not null default false, updated_at timestamptz not null default now());
create table public.registrations (id uuid primary key default gen_random_uuid(), session_id uuid not null references sessions on delete cascade, user_id uuid not null references profiles on delete cascade, status text not null check(status in ('approved','pending','waitlisted','cancelled','rejected','removed')), created_at timestamptz not null default now(), unique(session_id,user_id));
create index registrations_capacity on registrations(session_id,status,created_at,id);
create index registrations_user on registrations(user_id);
create table public.session_messages (id uuid primary key default gen_random_uuid(), session_id uuid not null references sessions on delete cascade, user_id uuid not null references profiles, parent_id uuid references session_messages on delete cascade, body text not null check(length(body) between 1 and 4000), announcement boolean not null default false, created_at timestamptz not null default now(), edited_at timestamptz);
create index messages_session on session_messages(session_id,created_at);
create table public.session_questions (id uuid primary key default gen_random_uuid(), session_id uuid not null references sessions on delete cascade, user_id uuid not null references profiles, body text not null check(length(body) between 1 and 4000), answer text check(length(answer)<=4000), resolved boolean not null default false, pinned boolean not null default false, created_at timestamptz not null default now());
create table public.question_votes (question_id uuid references session_questions on delete cascade, user_id uuid references profiles on delete cascade, primary key(question_id,user_id));
create table public.message_reactions (message_id uuid references session_messages on delete cascade, user_id uuid references profiles on delete cascade, primary key(message_id,user_id));
create table public.session_resources (id uuid primary key default gen_random_uuid(), session_id uuid not null references sessions on delete cascade, owner_id uuid not null references profiles, name text not null, storage_path text not null, created_at timestamptz not null default now());
create table public.session_requests (id uuid primary key default gen_random_uuid(), creator_id uuid not null references profiles, topic text not null check(length(topic) between 5 and 140), description text not null check(length(description) between 10 and 4000), category_id uuid not null references categories, difficulty text not null default 'Beginner', preferred_schedule text not null default '', language text not null default 'English', tags text not null default '', session_id uuid references sessions, created_at timestamptz not null default now());
create table public.request_interests (request_id uuid references session_requests on delete cascade, user_id uuid references profiles on delete cascade, primary key(request_id,user_id));
create table public.host_proposals (id uuid primary key default gen_random_uuid(), request_id uuid not null references session_requests on delete cascade, host_id uuid not null references profiles, note text not null check(length(note) between 5 and 1000), status text not null default 'pending' check(status in ('pending','accepted','rejected')), created_at timestamptz not null default now(), unique(request_id,host_id));
create unique index one_accepted_proposal on host_proposals(request_id) where status='accepted';
create table public.instant_doubt_requests (id uuid primary key default gen_random_uuid(), creator_id uuid not null references profiles, topic text not null check(length(topic) between 5 and 140), subject text not null, description text not null check(length(description) between 10 and 4000), urgency text not null check(urgency in ('Whenever possible','Today','Now')), expected_minutes int not null check(expected_minutes between 5 and 120), language text not null default 'English', difficulty text not null default 'Beginner', status text not null default 'pending' check(status in ('pending','accepted','resolved','cancelled','expired')), helper_id uuid references profiles, expires_at timestamptz not null default now()+interval '1 day', created_at timestamptz not null default now());
create table public.doubt_volunteers (doubt_id uuid references instant_doubt_requests on delete cascade, user_id uuid references profiles on delete cascade, created_at timestamptz not null default now(), primary key(doubt_id,user_id));
create table public.doubt_links (doubt_id uuid primary key references instant_doubt_requests on delete cascade, meeting_url text not null);
create table public.circle_posts (id uuid primary key default gen_random_uuid(), circle_id uuid not null references study_circles on delete cascade, user_id uuid not null references profiles, body text not null check(length(body) between 1 and 4000), created_at timestamptz not null default now());
create table public.follows (follower_id uuid references profiles on delete cascade, followed_id uuid references profiles on delete cascade, primary key(follower_id,followed_id), check(follower_id<>followed_id));
create table public.topic_follows (user_id uuid references profiles on delete cascade, category_id uuid references categories on delete cascade, primary key(user_id,category_id));
create table public.host_reviews (id uuid primary key default gen_random_uuid(), session_id uuid not null references sessions on delete cascade, user_id uuid not null references profiles, rating int not null check(rating between 1 and 5), relevance int check(relevance between 1 and 5), clarity int check(clarity between 1 and 5), helpfulness int check(helpfulness between 1 and 5), feedback text not null default '' check(length(feedback)<=2000), created_at timestamptz not null default now(), unique(session_id,user_id));
create table public.saved_sessions (user_id uuid references profiles on delete cascade, session_id uuid references sessions on delete cascade, primary key(user_id,session_id));
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade, kind text not null, message text not null, href text not null default '/dashboard', read_at timestamptz, created_at timestamptz not null default now());
create index notifications_user on notifications(user_id,created_at desc);
create table public.notification_preferences (user_id uuid primary key references profiles on delete cascade, muted boolean not null default false);
create table public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references profiles, target_type text not null check(target_type in ('session','message','profile','circle_post')), target_id uuid not null, reason text not null check(length(reason) between 5 and 2000), status text not null default 'open' check(status in ('open','reviewed')), created_at timestamptz not null default now());
create table public.user_blocks (user_id uuid references profiles on delete cascade, blocked_id uuid references profiles on delete cascade, primary key(user_id,blocked_id), check(user_id<>blocked_id));
create table public.moderation_actions (id uuid primary key default gen_random_uuid(), actor_id uuid not null references profiles, report_id uuid references reports, action text not null, reason text not null, created_at timestamptz not null default now());
create table public.audit_logs (id uuid primary key default gen_random_uuid(), actor_id uuid references profiles, action text not null, target_id uuid, created_at timestamptz not null default now());
create table public.rate_events (id bigint generated always as identity primary key, user_id uuid not null references profiles on delete cascade, action text not null, created_at timestamptz not null default now());
create index rate_lookup on rate_events(user_id,action,created_at);

create function public.create_profile() returns trigger language plpgsql security definer set search_path=public as $$ begin insert into profiles(id) values(new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();
create function public.is_staff() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from user_roles where user_id=auth.uid() and role in ('moderator','admin')) $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from user_roles where user_id=auth.uid() and role='admin') $$;
create function public.member_of(sid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from sessions where id=sid and host_id=auth.uid()) or exists(select 1 from registrations where session_id=sid and user_id=auth.uid() and status='approved') $$;
create function public.can_view_session(sid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from sessions s where s.id=sid and (s.host_id=auth.uid() or (s.status<>'draft' and s.visibility in ('public','unlisted')) or exists(select 1 from registrations r where r.session_id=s.id and r.user_id=auth.uid() and r.status in ('approved','pending','waitlisted')))) or is_staff() $$;
create function public.circle_member(cid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from study_circles where id=cid and owner_id=auth.uid()) or exists(select 1 from circle_memberships where circle_id=cid and user_id=auth.uid() and status='approved') $$;
create function public.circle_manager(cid uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from study_circles where id=cid and owner_id=auth.uid()) or exists(select 1 from circle_memberships where circle_id=cid and user_id=auth.uid() and status='approved' and role='moderator') $$;
create function public.blocked(other uuid) returns boolean language sql stable security definer set search_path=public as $$ select exists(select 1 from user_blocks where (user_id=auth.uid() and blocked_id=other) or (blocked_id=auth.uid() and user_id=other)) $$;
create function public.require_student() returns uuid language plpgsql security definer set search_path=public as $$ declare uid uuid:=auth.uid(); begin if uid is null or not exists(select 1 from auth.users where id=uid and email_confirmed_at is not null) then raise exception 'Sign in with a verified email to continue'; end if; if not exists(select 1 from profiles where id=uid and onboarded and not suspended) then raise exception 'Complete your profile, or contact support if your account is suspended'; end if; if exists(select 1 from auth.users where id=uid and is_anonymous) then raise exception 'Verified account required'; end if; return uid; end $$;
create function public.throttle(kind text, lim int default 20) returns void language plpgsql security definer set search_path=public as $$ declare uid uuid:=require_student(); begin perform pg_advisory_xact_lock(hashtext(uid::text||kind)); if (select count(*) from rate_events where user_id=uid and action=kind and created_at>now()-interval '1 hour')>=lim then raise exception 'Too many requests. Please try again later.'; end if; insert into rate_events(user_id,action) values(uid,kind); end $$;
create function public.notify(uid uuid, k text, msg text, link text default '/dashboard') returns void language sql security definer set search_path=public as $$ insert into notifications(user_id,kind,message,href) select uid,k,msg,link where not exists(select 1 from notification_preferences where user_id=uid and muted) $$;
create function public.valid_meeting_url(u text) returns boolean language sql immutable as $$ select length(u)<=2048 and u ~ '^https://(meet\.google\.com/[a-z]{3}-[a-z]{4}-[a-z]{3}/?|([a-z0-9-]+\.)?zoom\.us/(j|my)/[a-zA-Z0-9._-]+/?|teams\.(microsoft|live)\.com/(l/meetup-join|meet)/[^?#@[:space:]]+)(\?[^#[:space:]]*)?$' and u !~* '[?&](url|redirect|redirect_uri|redirect_url|next|return|returnurl|continue)=' and u !~* '[?&][^=&]*%[0-9a-f]{2}[^=&]*=' $$;

create function public.save_profile(p jsonb) returns void language plpgsql security definer set search_path=public as $$ begin if auth.uid() is null then raise exception 'Sign in first'; end if; if length(p->>'interests')>500 or length(p->>'skills')>500 or length(p->>'learn')>500 or length(p->>'teach')>500 or length(p->>'college')>150 or length(p->>'course')>150 or length(p->>'year')>30 or length(p->>'language')>50 or not exists(select 1 from pg_timezone_names where name=p->>'time_zone') then raise exception 'Invalid profile fields'; end if;
 update profiles set display_name=p->>'display_name',username=p->>'username',bio=p->>'bio',interests=p->>'interests',skills=p->>'skills',learn=p->>'learn',teach=p->>'teach',language=p->>'language',time_zone=p->>'time_zone',onboarded=true where id=auth.uid();
 insert into profile_academics(user_id,college,course,year,academic_public) values(auth.uid(),p->>'college',p->>'course',p->>'year',(p->>'academic_public')::boolean) on conflict(user_id) do update set college=excluded.college,course=excluded.course,year=excluded.year,academic_public=excluded.academic_public; end $$;

create function public.save_session(p jsonb) returns uuid language plpgsql security definer set search_path=public as $$ declare uid uuid:=require_student(); sid uuid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid()); existing sessions; begin
 perform throttle('hosting',30);
 if not coalesce((p->>'authorized')::boolean,false) or not valid_meeting_url(p->>'meeting_url') then raise exception 'Confirm permission and use an approved HTTPS meeting URL'; end if;
 if not ((p->>'provider'='Google Meet' and p->>'meeting_url' like 'https://meet.google.com/%') or (p->>'provider'='Zoom' and p->>'meeting_url' ~ '^https://([a-z0-9-]+\.)?zoom\.us/') or (p->>'provider'='Microsoft Teams' and p->>'meeting_url' ~ '^https://teams\.(microsoft|live)\.com/')) then raise exception 'Meeting provider does not match URL'; end if;
 if (p->>'starts_at')::timestamptz<=now() or p->>'status' not in ('draft','published') then raise exception 'Choose a future time and valid status'; end if;
 if length(p->>'objectives')>4000 or length(p->>'prerequisites')>2000 or length(p->>'language')>50 or not exists(select 1 from pg_timezone_names where name=p->>'time_zone') then raise exception 'Invalid session fields'; end if;
 if nullif(p->>'circle_id','') is not null and not circle_member((p->>'circle_id')::uuid) then raise exception 'Join this circle first'; end if;
 select * into existing from sessions where id=sid for update;
 if found and (existing.host_id<>uid or existing.status='cancelled' or existing.ends_at<now()) then raise exception 'You cannot edit this session'; end if;
 if existing.id is not null and existing.status='published' and p->>'status'='draft' then raise exception 'Published sessions cannot return to draft'; end if;
 if (p->>'capacity')::int<(select count(*) from registrations where session_id=sid and status='approved') then raise exception 'Capacity cannot be below approved registrations'; end if;
 insert into sessions(id,host_id,category_id,circle_id,title,description,subject,tags,difficulty,language,starts_at,ends_at,time_zone,capacity,provider,objectives,prerequisites,visibility,registration_mode,status,join_minutes)
 values(sid,uid,(p->>'category_id')::uuid,nullif(p->>'circle_id','')::uuid,p->>'title',p->>'description',p->>'subject',p->>'tags',p->>'difficulty',p->>'language',(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,p->>'time_zone',(p->>'capacity')::int,p->>'provider',p->>'objectives',p->>'prerequisites',p->>'visibility',p->>'registration_mode',p->>'status',(p->>'join_minutes')::int)
 on conflict(id) do update set category_id=excluded.category_id,circle_id=excluded.circle_id,title=excluded.title,description=excluded.description,subject=excluded.subject,tags=excluded.tags,difficulty=excluded.difficulty,language=excluded.language,starts_at=excluded.starts_at,ends_at=excluded.ends_at,time_zone=excluded.time_zone,capacity=excluded.capacity,provider=excluded.provider,objectives=excluded.objectives,prerequisites=excluded.prerequisites,visibility=excluded.visibility,registration_mode=excluded.registration_mode,status=excluded.status,join_minutes=excluded.join_minutes,updated_at=now();
 insert into session_links(session_id,meeting_url) values(sid,p->>'meeting_url') on conflict(session_id) do update set meeting_url=excluded.meeting_url,revoked=false,updated_at=now();
 if existing.id is not null then insert into notifications(user_id,kind,message,href) select user_id,'session_changed','The host updated '||(p->>'title'),'/sessions/'||sid from registrations where session_id=sid and status in ('approved','pending','waitlisted') and not exists(select 1 from notification_preferences np where np.user_id=registrations.user_id and muted); end if;
 insert into audit_logs(actor_id,action,target_id) values(uid,'session_saved',sid); return sid; end $$;

create function public.promote_waitlist(sid uuid) returns void language plpgsql security definer set search_path=public as $$ declare s sessions; r registrations; begin select * into s from sessions where id=sid for update; if s.status<>'published' or s.ends_at<=now() then return; end if;
 while (select count(*) from registrations where session_id=sid and status='approved')<s.capacity loop
 select * into r from registrations where session_id=sid and status='waitlisted' order by created_at,id limit 1 for update; exit when not found;
 update registrations set status='approved' where id=r.id; perform notify(r.user_id,'registration_approved','A place opened up in '||s.title,'/sessions/'||sid);
 end loop; end $$;
create function public.register_session(sid uuid) returns text language plpgsql security definer set search_path=public as $$ declare uid uuid:=require_student(); s sessions; st text; old text; begin
 perform throttle('registration',60); select * into s from sessions where id=sid for update;
 if not found or not can_view_session(sid) or s.status<>'published' or s.registration_closed or s.ends_at<=now() or s.host_id=uid or blocked(s.host_id) then raise exception 'This session is not available for registration'; end if;
 select status into old from registrations where session_id=sid and user_id=uid;
 if old in ('removed','rejected') then raise exception 'The host has declined your participation'; end if;
 if old in ('approved','waitlisted','pending') then return old; end if;
 st:=case when s.registration_mode='approval' then 'pending' when (select count(*) from registrations where session_id=sid and status='approved')>=s.capacity then 'waitlisted' else 'approved' end;
 insert into registrations(session_id,user_id,status) values(sid,uid,st) on conflict(session_id,user_id) do update set status=excluded.status,created_at=now();
 perform notify(uid,'registration_'||st,'Your registration for '||s.title||' is '||st,'/sessions/'||sid); return st; end $$;
create function public.change_registration(sid uuid, target uuid, decision text) returns void language plpgsql security definer set search_path=public as $$ declare uid uuid:=require_student(); s sessions; r registrations; begin
 select * into s from sessions where id=sid for update; select * into r from registrations where session_id=sid and user_id=target for update;
 if r.id is null then raise exception 'Registration not found'; end if;
 if decision='cancelled' and uid=target then null; elsif s.host_id=uid and decision in ('approved','rejected','removed') then null; else raise exception 'Not authorized'; end if;
 if decision='approved' then if r.status not in ('pending','waitlisted') or s.status<>'published' or s.ends_at<=now() then raise exception 'Cannot approve this registration'; end if; if (select count(*) from registrations where session_id=sid and status='approved')>=s.capacity then raise exception 'This session is full'; end if; end if;
 update registrations set status=decision where id=r.id; perform promote_waitlist(sid); perform notify(target,'registration_'||decision,'Your registration is now '||decision,'/sessions/'||sid); end $$;
create function public.session_control(sid uuid, action text) returns void language plpgsql security definer set search_path=public as $$ declare uid uuid:=require_student(); s sessions; begin select * into s from sessions where id=sid for update; if s.host_id is distinct from uid then raise exception 'Host access required'; end if;
 if action='cancel' then update sessions set status='cancelled',updated_at=now() where id=sid; update session_links set revoked=true where session_id=sid; insert into notifications(user_id,kind,message,href) select user_id,'session_cancelled',s.title||' was cancelled','/sessions/'||sid from registrations where session_id=sid and status in ('approved','pending','waitlisted');
 elsif action='close' then update sessions set registration_closed=true where id=sid;
 elsif action='reopen' and s.status='published' and s.ends_at>now() then update sessions set registration_closed=false where id=sid;
 elsif action='revoke' then update session_links set revoked=true where session_id=sid;
 else raise exception 'Invalid action'; end if; insert into audit_logs(actor_id,action,target_id) values(uid,action,sid); end $$;
create function public.join_details(sid uuid) returns text language plpgsql security definer set search_path=public as $$ declare uid uuid:=require_student(); s sessions; link session_links; begin
 select * into s from sessions where id=sid; select * into link from session_links where session_id=sid;
 if s.host_id=uid then return link.meeting_url; end if;
 if s.status<>'published' or link.revoked or not member_of(sid) or blocked(s.host_id) or now()<s.starts_at-make_interval(mins=>s.join_minutes) or now()>s.ends_at then raise exception 'Joining details are available only to approved participants during the join window'; end if;
 if s.id is null then raise exception 'Session unavailable'; end if; return link.meeting_url; end $$;
create function public.session_capacity(sid uuid) returns int language sql stable security definer set search_path=public as $$ select greatest(0,capacity-(select count(*)::int from registrations where session_id=sid and status='approved')) from sessions where id=sid and can_view_session(sid) $$;

-- RLS is enabled on every application table; private tables deliberately have no read policy.
do $$ declare t text; begin for t in select tablename from pg_tables where schemaname='public' loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
create policy profiles_read on profiles for select using(true);
create policy academics_read on profile_academics for select using(user_id=auth.uid() or academic_public);
create policy roles_read on user_roles for select using(user_id=auth.uid() or is_admin());
create policy categories_read on categories for select using(active or is_admin());
create policy tags_read on tags for select using(true);
create policy interests_read on user_interests for select using(true);
create policy sessions_read on sessions for select using(can_view_session(id));
create policy session_tags_read on session_tags for select using(can_view_session(session_id));
create policy registrations_read on registrations for select using(user_id=auth.uid() or exists(select 1 from sessions where id=session_id and host_id=auth.uid()));
create policy messages_read on session_messages for select using(member_of(session_id) and not blocked(user_id));
create policy questions_read on session_questions for select using(member_of(session_id) and not blocked(user_id));
create policy votes_read on question_votes for select using(exists(select 1 from session_questions where id=question_id));
create policy reactions_read on message_reactions for select using(exists(select 1 from session_messages where id=message_id));
create policy resources_read on session_resources for select using(member_of(session_id));
create policy requests_read on session_requests for select using(true);
create policy request_interest_read on request_interests for select using(true);
create policy proposals_read on host_proposals for select using(true);
create policy doubts_read on instant_doubt_requests for select using(not blocked(creator_id));
create policy volunteers_read on doubt_volunteers for select using(true);
create policy circles_read on study_circles for select using(true);
create policy memberships_read on circle_memberships for select using(user_id=auth.uid() or circle_member(circle_id));
create policy circle_posts_read on circle_posts for select using(circle_member(circle_id) and not blocked(user_id));
create policy follows_read on follows for select using(true);
create policy topics_read on topic_follows for select using(user_id=auth.uid());
create policy reviews_read on host_reviews for select using(can_view_session(session_id));
create policy saved_read on saved_sessions for select using(user_id=auth.uid());
create policy notifications_read on notifications for select using(user_id=auth.uid());
create policy notification_preferences_read on notification_preferences for select using(user_id=auth.uid());
create policy reports_read on reports for select using(reporter_id=auth.uid() or is_staff());
create policy blocks_read on user_blocks for select using(user_id=auth.uid());
create policy moderation_read on moderation_actions for select using(is_staff());
create policy audit_read on audit_logs for select using(is_admin());

grant select on all tables in schema public to anon,authenticated;
revoke all on session_links,doubt_links,rate_events from anon,authenticated;
revoke execute on all functions in schema public from public,anon,authenticated;
grant execute on function is_staff(),is_admin(),member_of(uuid),can_view_session(uuid),circle_member(uuid),circle_manager(uuid),blocked(uuid),session_capacity(uuid) to anon,authenticated;
grant execute on function save_profile(jsonb),save_session(jsonb),register_session(uuid),change_registration(uuid,uuid,text),session_control(uuid,text),join_details(uuid) to authenticated;



