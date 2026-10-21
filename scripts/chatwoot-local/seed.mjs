import {writeFile} from "node:fs/promises";
import path from "node:path";
import {state,rails,runtime} from "./common.mjs";
const s=await state();
const code=`
require "json"
papp=PlatformApp.find_or_create_by!(name: "OS PLUS Local QA")
rows=[]
[901,902].each_with_index do |id,index|
 name="Chat Local #{index+1}"
 account=Account.find_or_initialize_by(id: id)
 raise "Foreign fixture account" if account.persisted? && account.name!=name
 account.name=name
 account.save!
 email="owner#{index+1}@chat-local.example"
 user=User.find_or_initialize_by(email: email)
 unless user.persisted?
  user.name="#{name} Owner"
  user.password=${JSON.stringify(s.loginPassword)}
  user.password_confirmation=${JSON.stringify(s.loginPassword)}
  user.skip_confirmation!
  user.save!
 end
 AccountUser.find_or_create_by!(account: account,user: user){|u| u.role=:administrator}
 PlatformAppPermissible.find_or_create_by!(platform_app: papp,permissible: account)
 PlatformAppPermissible.find_or_create_by!(platform_app: papp,permissible: user)
 inbox=Inbox.find_by(id: id)
 unless inbox
  channel=Channel::WebWidget.create!(account: account,website_url: "http://localhost:4142",welcome_title:name,welcome_tagline:"Local test messages only",continuity_via_email:false)
  inbox=Inbox.create!(id:id,account:account,channel:channel,name:"#{name} Website",greeting_enabled:false,enable_auto_assignment:false)
 end
 raise "Foreign inbox" unless inbox.account_id==id
 InboxMember.find_or_create_by!(inbox:inbox,user:user)
 rows << {accountId:id,inboxId:inbox.id,email:email,token:user.access_token.token,websiteToken:inbox.channel.website_token}
end
# Explicit fixture IDs preserve the original OS PLUS synthetic account/inbox901.
ActiveRecord::Base.connection.reset_pk_sequence!("accounts")
ActiveRecord::Base.connection.reset_pk_sequence!("inboxes")
::Redis::Alfred.delete(::Redis::Alfred::CHATWOOT_INSTALLATION_ONBOARDING)
puts "LOCAL_RESULT="+{accounts:rows,platformToken:papp.access_token.token}.to_json
`;
const result=await rails(code);
const marker=result.split("\n").find(x=>x.startsWith("LOCAL_RESULT="));
if(!marker)throw new Error("Local fixture result missing; credentials not printed");
await writeFile(path.join(runtime,"accounts.private.json"),marker.slice(13));
await writeFile(path.join(runtime,"LOGIN.txt"),"LOCAL TEST INSTANCE ONLY — http://localhost:4141\nChat Local 1: owner1@chat-local.example\nChat Local 2: owner2@chat-local.example\nPassword for both: "+s.loginPassword+"\nNo real inboxes or email delivery configured.\n");
console.log("Two local Chatwoot accounts and website inboxes ready. Login details saved privately.");
