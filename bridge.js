const spawn = require('child_process').spawn;
const express = require('express');
const http = require('http');
const WebSocket = require('ws')
const PubSub =require( 'pubsub-js')
const sc = require('@supercollider/lang')

const app = express();
var server = http.createServer(app);

var wss = new WebSocket.Server({server: server});

let sclang;
let sclang_cache = []
const maxCachedReplies = 100;
let clients = []

startSclang()

function cacheReply(msg){
  sclang_cache.push(msg);
  if(sclang_cache.length > maxCachedReplies)
    sclang_cache = sclang_cache.slice(sclang_cache.length - maxCachedReplies)
}

function startSclang(){

  sclang = spawn(sc.resolveOptions().sclang,['-i','scwebide'])

  sclang.stdout.on('data',(data)=>{
    const reply = data.toString();
    cacheReply(reply)
    PubSub.publish("replies",reply);
    //console.log("from sclang", reply);
  });

  sclang.on('close', (code) => {
    PubSub.publish("sclang",'false');
    console.log(`child process exited with code ${code}`);
  });
}

wss.on('connection', client => {

  clients = [...clients,client]

  PubSub.publish("clients",clients)

  const sub = PubSub.subscribe("replies",(_,msg)=>{
    client.send(msg)
  })

  client.send(sclang_cache.join(''));

  client.onmessage = (m)=>{
    //console.log("from client", m.data);
    sclang.stdin.write(m.data,"UTF-8")
    PubSub.publish("queries", m.data);
    // Send the escape character which is interpreted by sclang as:
    // "evaluate the currently accumulated command line as SC code"
    sclang.stdin.write("\x0c", "UTF-8", error => error && console.error(error));
  }

  client.onclose = (m) => {
    clients = clients.filter(c=>c!=client)
    PubSub.unsubscribe(sub)
    PubSub.publish("clients",clients)
  }
/*sc.lang.boot().then(async lang => {
  // This function is declared as `async`
  // so for any function calls that return a Promise we can `await` the result.

  // This is an `async` function, so we can `await` the results of Promises.
  lang.on("state",(...data)=>{
    console.log("from sclang", data);
    client.send(data);
  });

  client.onmessage = (m)=>{
    console.log("to sclang: ",m.data);
    lang.interpret(m.data).then(result=>{
      console.log("res: ",result)
    });
  }


  //await lang.quit();
});*/
});

const port = 57190
server.listen(port);
console.log(`Listening on http://localhost:${port}`);
