const { app, BrowserWindow } = require('electron')
const PubSub =require( 'pubsub-js')

function createWindow () {
  // Create the browser window.
  let win = new BrowserWindow({
    width: 200,
    height: 101,
    frame: false,
    webPreferences: {
      nodeIntegration: true
    }
  })

  let test = require('./bridge')
  PubSub.subscribe("replies",(_,msg)=>{
    //console.log("repl",msg)
    win.webContents.send('lang', {reply:msg,status:true});
  })
  PubSub.subscribe("sclang",(_,msg)=>{
    win.webContents.send('lang', {status:msg});
  })
  PubSub.subscribe("clients",(_,msg)=>{
    win.webContents.send('clients', {n:msg.length});
  })
  PubSub.subscribe("queries",(_,msg)=>{
    win.webContents.send('clients',{query:msg.length});
  })

  // and load the index.html of the app.
  win.loadFile('index.html')
}

app.whenReady().then(createWindow)

app.on('window-all-closed', () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})
