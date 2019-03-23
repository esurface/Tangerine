import { Injectable } from '@angular/core';
import { AppConfigService } from './app-config.service';
import { UserService } from './user.service';
import PouchDB from 'pouchdb';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AppConfig } from 'src/app/app-config.class';
import { User } from './user.model.interface';

class StartSyncSessionResponse {
  doc_ids:string
  syncUrl:string
}

class SyncDetails {
  remoteDb:PouchDB
  localDb:PouchDB
  doc_ids:Array<string>
}

class ReplicationStatus {
  pulled:number
  pushed:number
  conflicts:number
}

@Injectable({
  providedIn: 'root'
})
export class PecSyncService {

  constructor(
    private appConfigService: AppConfigService,
    private profileService: UserService,
    private http: HttpClient
  ) { }

  async sync(username:string):Promise<ReplicationStatus> {
      const syncDetails = await this.setup(username)
      const pullReplicationStatus = await this.replicate(syncDetails.remoteDb, syncDetails.localDb, {doc_ids: syncDetails.doc_ids}) 
      const pushReplicationStatus = await this.replicate(syncDetails.localDb, syncDetails.remoteDb)
      return <ReplicationStatus>{
        pulled: pullReplicationStatus.pulled,
        pushed: pushReplicationStatus.pushed,
        conflicts: pushReplicationStatus.conflicts + pullReplicationStatus.conflicts
      }
  }

  syncObservable(username:string):Observable<ReplicationStatus> {
    return new Observable((observable) => {
      let currentSyncDetails:SyncDetails
      let pullReplicationStatus:ReplicationStatus
      let pushReplicationStatus:ReplicationStatus
      this.setup(username)
        .then(syncDetails => {
          currentSyncDetails = syncDetails
          return this.replicate(currentSyncDetails.remoteDb, currentSyncDetails.localDb, {doc_ids: currentSyncDetails.doc_ids}) 
        })
        .then(replicationStatus => {
          pullReplicationStatus = replicationStatus
          return this.replicate(currentSyncDetails.localDb, currentSyncDetails.remoteDb)
        })
        .then(replicationStatus => {
          pushReplicationStatus = replicationStatus
          observable.next(<ReplicationStatus>{
            pulled: pullReplicationStatus.pulled,
            pushed: pushReplicationStatus.pushed,
            conflicts: pushReplicationStatus.conflicts + pullReplicationStatus.conflicts
          })
        })
    })
  }

  async setup(username):Promise<SyncDetails> {
    const appConfig = await this.appConfigService.getAppConfig();
    let profileDoc = await this.profileService.getUserProfile(username)
    let params = new HttpParams()
    params.set('profileId', profileDoc._id)
    params.set('groupId', appConfig.groupName)
    const response = await this.http.get(`${appConfig.serverUrl}/api/start-sync-session`, { params }).toPromise()
    const localDb = new PouchDB(username);
    const remoteDb = new PouchDB(response['syncUrl']);
    const doc_ids:Array<string> = response['doc_ids']
    return <SyncDetails>{localDb, remoteDb, doc_ids}
  }

  replicate(sourceDb:PouchDB, targetDb:PouchDB, options = {}):Promise<ReplicationStatus> {
    return new Promise((resolve, reject) => {
      sourceDb.replicate.to(targetDb, options).on('complete', function (info) {
        resolve(<ReplicationStatus>{
          pulled: info.docs_written,
          pushed: 0,
          conflicts: info.doc_write_failures
        })
      }).on('error', function (errorMessage) {
        console.log("boo, something went wrong! error: " + errorMessage)
        reject(errorMessage)
      });
    })
  }

}
