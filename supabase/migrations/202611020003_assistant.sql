create function public.ai_allow() returns void language plpgsql security definer set search_path=public as $$ begin perform throttle('assistant',20); end $$;
revoke execute on function ai_allow() from public,anon;
grant execute on function ai_allow() to authenticated;
