const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  windowMinimize: () => ipcRenderer.send('window-minimize'),
  windowMaximize: () => ipcRenderer.send('window-maximize'),
  windowClose: () => ipcRenderer.send('window-close'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),

  dbGetAllAlbums: () => ipcRenderer.invoke('db-get-all-albums'),
  dbSearchAlbums: (query) => ipcRenderer.invoke('db-search-albums', query),
  dbGetGenres: () => ipcRenderer.invoke('db-get-genres'),
  dbGetArtists: () => ipcRenderer.invoke('db-get-artists'),
  dbGetDecades: () => ipcRenderer.invoke('db-get-decades'),

  dbUpdateStatus: (data) => ipcRenderer.invoke('db-update-status', data),
  dbUpdateRating: (data) => ipcRenderer.invoke('db-update-rating', data),
  dbUpdateNotes: (data) => ipcRenderer.invoke('db-update-notes', data),
  dbUpdateDateHeard: (data) => ipcRenderer.invoke('db-update-date-heard', data),
  dbInsertAlbum: (album, status, notes) => ipcRenderer.invoke('db-insert-album', { album, status, notes }),
  dbDeleteAlbum: (id) => ipcRenderer.invoke('db-delete-album', id),
  dbDeleteAlbums: (ids) => ipcRenderer.invoke('db-delete-albums', ids),
  dbGetStats: () => ipcRenderer.invoke('db-get-stats'),
  dbGetBlockedRegions: () => ipcRenderer.invoke('db-get-blocked-regions'),
  dbAddBlockedRegion: (data) => ipcRenderer.invoke('db-add-blocked-region', data),
  dbRemoveBlockedRegion: (name) => ipcRenderer.invoke('db-remove-blocked-region', name),

  dbCheckMbidExists: (mbid) => ipcRenderer.invoke('db-check-mbid-exists', mbid),
  dbCheckTitleArtistExists: (data) => ipcRenderer.invoke('db-check-title-artist-exists', data),
  dbGetSetting: (key) => ipcRenderer.invoke('db-get-setting', key),
  dbSetSetting: (data) => ipcRenderer.invoke('db-set-setting', data),
  dbRestoreAlbums: (albums) => ipcRenderer.invoke('db-restore-albums', albums),
  dbRestoreProgress: (entries) => ipcRenderer.invoke('db-restore-progress', entries),

  dbGetPlayCount: (id) => ipcRenderer.invoke('db-get-play-count', id),
  dbResetPlayCount: (id) => ipcRenderer.invoke('db-reset-play-count', id),
  dbIncrementPlayCount: (id) => ipcRenderer.invoke('db-increment-play-count', id),
  chooseBackupDir: () => ipcRenderer.invoke('choose-backup-dir'),
  dialogConfirm: (data) => ipcRenderer.invoke('dialog-confirm', data),
  dialogConfirmTyped: (data) => ipcRenderer.invoke('dialog-confirm-typed', data),

  queueInsertBatch: (items) => ipcRenderer.invoke('queue-insert-batch', items),
  queueGetAll: () => ipcRenderer.invoke('queue-get-all'),
  queueGetStats: () => ipcRenderer.invoke('queue-get-stats'),
  queueRetryFailed: () => ipcRenderer.invoke('queue-retry-failed'),
  queueClear: () => ipcRenderer.invoke('queue-clear'),
  triggerWorker: () => ipcRenderer.send('trigger-worker'),
  searchLive: (query) => ipcRenderer.invoke('search-live', query),
  onQueueProgress: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('queue-progress', handler);
    return () => ipcRenderer.removeListener('queue-progress', handler);
  },

  getDataDir: () => ipcRenderer.invoke('get-data-dir'),
  chooseDataDir: () => ipcRenderer.invoke('choose-data-dir'),
  getCrossImage: () => ipcRenderer.invoke('get-cross-image'),
});
