create or replace function generate_qr_identity_token()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  loop
    v_token := encode(extensions.gen_random_bytes(24), 'hex');
    exit when not exists (
      select 1
      from qr_identities
      where token = v_token
    );
  end loop;

  return v_token;
end;
$$;

comment on function generate_qr_identity_token()
is 'Generates opaque QR identity tokens for V2 Laundry entities using schema-qualified pgcrypto bytes under a restricted search_path.';
