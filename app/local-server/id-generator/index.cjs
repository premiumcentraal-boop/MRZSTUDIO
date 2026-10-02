// Optional standalone API entry for SDK development. Normal use: mrz start.
const args=process.argv.slice(2), flag=args.indexOf('--port');
if(flag>=0){const port=Number(args[flag+1]);if(!Number.isInteger(port)||port<1025||port>65535)throw Error('--port must be 1025–65535.');process.env.LOCAL_API_PORT=String(port);}
process.env.LOCAL_API_HOST='127.0.0.1';
require('../server.js');
