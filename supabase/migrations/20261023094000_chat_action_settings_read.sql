begin;
create function chat_action_settings_read(p_context jsonb) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare t uuid;result jsonb;
begin
 t:=chat_lead_authorize(p_context);
 perform 1 from tenant_users where tenant_id=t and clerk_user_id=p_context#>>'{actor,id}' and role='owner_admin' and status='active';
 if not found then raise exception 'Owner access required';end if;
 return jsonb_build_object(
 'channels',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'kind',c.kind,'mode',c.agent_mode,'canBook',c.can_book,
 'version',coalesce(a.version,0),'packId',p.id,'packVersion',p.version,'bookingCapability',p.pack_json#>>'{booking,capability}',
 'autoApproved',coalesce(a.approved_at is not null and a.pack_id=p.id,false)) order by c.name,c.id)
 from chat_channels c left join chat_channel_action_approvals a on a.tenant_id=t and a.channel_id=c.id
 left join chat_knowledge_packs p on p.tenant_id=t and p.brand_id=c.brand_id and p.status='published'
 where c.tenant_id=t and c.is_active),'[]'),
 'branches',coalesce((select jsonb_agg(jsonb_build_object('channelId',c.id,'id',l.id,'name',l.name,'teamId',r.team_id) order by l.name,l.id)
 from chat_channels c join chat_brand_locations b on b.tenant_id=t and b.brand_id=c.brand_id
 join tenant_locations l on l.tenant_id=t and l.id=b.location_id and l.is_active and l.deleted_at is null
 left join chat_action_routes r on r.tenant_id=t and r.channel_id=c.id and r.location_id=l.id where c.tenant_id=t and c.is_active),'[]'),
 'teams',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',name) order by name,id) from teams where tenant_id=t and is_active and deleted_at is null),'[]')
 );
end $$;
revoke all on function chat_action_settings_read(jsonb) from public,anon,authenticated;
grant execute on function chat_action_settings_read(jsonb) to service_role;
commit;
