import {state,owned,compose,command,root} from "./common.mjs";
await owned(await state());
await compose("stop","rails","sidekiq");
try{
 console.log(await command(process.execPath,["scripts/chatwoot-local/restore-qa.mjs"],{cwd:root}));
}finally{
 await compose("start","rails","sidekiq");
 console.log("Owned Chatwoot writers restarted");
}
