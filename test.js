const { app, systemPreferences } = require('electron'); app.whenReady().then(() => { console.log(systemPreferences.getMediaAccessStatus('screen')); app.quit(); })
