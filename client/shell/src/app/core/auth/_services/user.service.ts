import 'rxjs/add/observable/from';
import 'rxjs/add/operator/filter';

import { Injectable } from '@angular/core';
import * as bcrypt from 'bcryptjs';
import { Uuid } from 'ng2-uuid';
import PouchDB from 'pouchdb';
import PouchDBFind from 'pouchdb-find';
import { Observable } from 'rxjs/Observable';
import { TangyFormService } from '../../../tangy-forms/tangy-form-service.js';
import { updates } from '../../update/update/updates';

@Injectable()
export class UserService {
  userData = {};
  DB = new PouchDB('users');
  USER_DATABASE_NAME = 'currentUser';
  constructor(private uuid: Uuid) { }

  async create(payload) {
    const userUUID = this.uuid.v1();
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync(payload.password, salt);
    this.userData = payload;
    this.userData['userUUID'] = userUUID;
    this.userData['password'] = hash;
    try {
      /**TODO: check if user exists before saving */
      const postUserdata = await this.DB.post(this.userData);
      const userDb = new PouchDB(this.userData['username']);

      if (postUserdata) {
        const result = await this.initUserProfile(this.userData['username'], userUUID);
        const tangyFormService = new TangyFormService({ databaseName: this.userData['username'] });
        await tangyFormService.initialize();
        await userDb.put({
          _id: 'info',
          atUpdateIndex: updates.length-1
        })
        return result;
      }
    } catch (error) {
      console.error(error);
    }
  }

  async initUserProfile(userDBPath, profileId) {
    if (userDBPath) {
      const userDB = new PouchDB(userDBPath);
      try {
        const result = await userDB.put({
          _id: profileId,
          collection: 'user-profile'
        });
        return result;
      } catch (error) {
        console.error(error);
      }
    }
  }

  async getUserUUID() {
    const username = await this.getUserDatabase();
    try {
      PouchDB.plugin(PouchDBFind);
      const result = await this.DB.find({ selector: { username } });
      if (result.docs.length > 0) {
        return result.docs[0]['userUUID'];
      } else { console.error('Unsuccessful'); }
    } catch (error) {

      console.error(error);
    }
  }
  async getUserProfileId() {
    const userDBPath = await this.getUserDatabase();
    if (userDBPath) {
      const userDB = new PouchDB(userDBPath);
      let userProfileId: string;
      PouchDB.plugin(PouchDBFind);
      userDB.createIndex({
        index: { fields: ['collection'] }
      }).then((data) => { console.log('Indexing Succesful'); })
        .catch(err => console.error(err));

      try {
        const result = await userDB.find({ selector: { collection: 'user-profile' } });
        if (result.docs.length > 0) {
          userProfileId = result.docs[0]['_id'];
        }
      } catch (error) {
        console.error(error);
      }
      return userProfileId;
    }
  }

  async getUserProfile() {
    const databaseName = await this.getUserDatabase();
    const tangyFormService = new TangyFormService({ databaseName });
    const results = await tangyFormService.getResponsesByFormId('user-profile');
    return results[0];
  }

  async doesUserExist(username) {
    let userExists: boolean;
    if (username) {
      PouchDB.plugin(PouchDBFind);
      /**
       * @TODO We may want to run this on the first time when the app runs.
       */
      this.DB.createIndex({
        index: { fields: ['username'] }
      }).then((data) => { console.log('Indexing Succesful'); })
        .catch(err => console.error(err));

      try {
        const result = await this.DB.find({ selector: { username } });
        if (result.docs.length > 0) {
          userExists = true;
        } else { userExists = false; }
      } catch (error) {
        userExists = true;
        console.error(error);
      }
    } else {
      userExists = true;
      return userExists;
    }
    return userExists;
  }

  async getAllUsers() {

    try {
      const result = await this.DB.allDocs({ include_docs: true });

      const users = [];
      Observable.from(result.rows).map(doc => doc).filter(doc => !doc['id'].startsWith('_design')).subscribe(doc => {
        users.push({
          username: doc['doc'].username,
          email: doc['doc'].email
        });
      });
      return users;
    } catch (error) {
      console.error(error);
    }
  }

  async setUserDatabase(username) {
    return await localStorage.setItem(this.USER_DATABASE_NAME, username);
  }

  async getUserDatabase() {
    return await localStorage.getItem(this.USER_DATABASE_NAME);
  }

  async removeUserDatabase() {
    localStorage.removeItem(this.USER_DATABASE_NAME);
  }

}
