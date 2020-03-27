const spawn = require('child_process').spawn;
const express = require('express');
const http = require('http');
const WebSocket = require('ws')
const PubSub =require( 'pubsub-js')
const sc = require('@supercollider/lang')
const {dialog} = require('electron')
const Store = require('electron-store');
const userPrefs = new Store();

const MAX_CACHED_REPLIES = 100;

const defaultSclang = {
  darwin: '/Applications/SuperCollider.app/Contents/MacOs/sclang',
  linux: 'sclang',
  win32: 'START /B sclang'
}

class Bridge{

  constructor(){
    console.log("[Bridge] constructing")
    this.sclang_path = userPrefs.get('sclang')
    console.log("[Bridge] saved sclang: ", this.sclang_path)
    this.sclang_cache = [];
    this.clients = []
    this.port = 57190
  }


  getSclang(){
    if(!this.sclang_path || this.sclang_path == ''){
      this.sclang_path = defaultSclang[process.platform] || ''
    }
    return this.sclang_path
  }

  start(){
    console.log("[Bridge] starting sclang")
    const sclang_path = this.getSclang()
    console.log("[Bridge] sclang path: ",sclang_path)
    try{
      this.sclang = spawn(sclang_path,['-i','scwebide'])
    }catch(err){
      throw err
    }

    this.sclang.stdout.on('data',(data)=>{
      if(!this.sclang_connected) {
        this.sclang_connected = true;
        this.storeSclangPath();
        this.startServer();
      }

      const reply = data.toString();
      this.cacheReply(reply)
      PubSub.publish("replies",reply);
      //console.log("from sclang", reply);
    });

    this.sclang.on('close', (code) => this.disconnectSclang(code));
    this.sclang.on('error', (err) => this.sclangError(err));
    this.sclang.on('exit', (code) => this.disconnectSclang(code));

  }

  disconnectSclang(code){
    PubSub.publish("sclang",'false');
    console.log(`child process exited with code ${code}`);
  }

  sclangError(err){
    PubSub.publish("sclang",'false');
    this.selectSclangPath()
  }

  selectSclangPath(){
    dialog.showOpenDialog({ properties: ['openFile'] }).then(
      file=>{
        this.sclang_path = file.filePaths[0];
        this.startSclang()
      }
    )
  }

  storeSclangPath(){
    userPrefs.set('sclang',this.sclang_path);
  }

  cacheReply(msg){
    this.sclang_cache.push(msg);
    if(this.sclang_cache.length > MAX_CACHED_REPLIES)
      this.sclang_cache = sthis.clang_cache.slice(this.sclang_cache.length - MAX_CACHED_REPLIES)
  }

  startServer(){

    console.log("[Server] starting")

    this.express = express;
    this.server = http.createServer(this.express);
    this.wss = new WebSocket.Server({server: this.server});


    this.wss.on('connection', client => {

      this.clients = [...this.clients,client]

      PubSub.publish("clients",this.clients)

      const sub = PubSub.subscribe("replies",(_,msg)=>{
        client.send(msg)
      })

      client.send(this.sclang_cache.join(''));

      client.onmessage = (m)=>{
        //console.log("from client", m.data);
        this.sclang.stdin.write(m.data,"UTF-8")
        PubSub.publish("queries", m.data);
        // Send the escape character which is interpreted by sclang as:
        // "evaluate the currently accumulated command line as SC code"
        this.sclang.stdin.write("\x0c", "UTF-8", error => error && console.error(error));
      }

      client.onclose = (m) => {
        this.clients = this.clients.filter(c=>c!=client)
        PubSub.unsubscribe(sub)
        PubSub.publish("clients",this.clients)
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

    this.server.listen(this.port);
    console.log(`[Server] Listening on http://localhost:${this.port}`);
  }
}

module.exports = {Bridge}
