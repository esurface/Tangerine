const fs = require('fs-extra');
const util = require('util');
const junk = require('junk');
const {
  doesUserExist,
  hashPassword,
  USERS_DB,
  isSuperAdmin,
  findUserByUsername,
} = require('./auth');

const registerUser = async (req, res) => {
  try {
    if (!(await doesUserExist(req.body.username))) {
      const user = req.body;
      user.password = await hashPassword(user.password);
      user.groups = [];
      const data = await USERS_DB.post(user);
      res.send({ statusCode: 200, data });
      return data;
    }
  } catch (error) {
    res.send('Could Not Create user');
  }
};

const getUserByUsername = async (req, res) => {
  const username = req.params.username;
  try {
    await USERS_DB.createIndex({ index: { fields: ['username'] } });
    const results = await USERS_DB.find({
      selector: { username: { $regex: `(?i)${username}` } },
    });
    const data = results.docs.map(user => user.username);
    res.send({ data, statusCode: 200, statusMessage: 'Ok' });
  } catch (error) {
    res.sendStatus(500);
  }
};

const isUserSuperAdmin = async (req, res) => {
  try {
    const data = await isSuperAdmin(req.params.username);
    res.send({ data, statusCode: 200, statusMessage: 'ok' });
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
};

const isUserAnAdminUser = async (req, res) => {
  try {
    const data = await isAdminUser(req.params.username);
    res.send({ data, statusCode: 200, statusMessage: 'ok' });
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
};

// If is not admin, return false else return the list of the groups to which user isAdmin
async function isAdminUser(username) {
  try {
    const groups = await getGroupsByUser(username);
    let data = groups.filter(group => group.attributes.role === 'admin');
    if (data.length < 1) {
      data = false;
    }
    return data;
  } catch (error) {
    console.log(error);
    return false;
  }
}

async function getGroupsByUser(username) {
  if (await isSuperAdmin(username)) {
    const readdirPromisified = util.promisify(fs.readdir);
    const files = await readdirPromisified('/tangerine/client/content/groups');
    let filteredFiles = files
      .filter(junk.not)
      .filter(name => name !== '.git' && name !== 'README.md');
    let groups = [];
    groups = filteredFiles.map(groupName => {
      return {
        attributes: {
          name: groupName,
          role: 'admin',
        },
      };
    });
    return groups;
  } else {
    const user = await findUserByUsername(username);
    let groups = [];
    if (typeof user.groups !== 'undefined') {
      groups = user.groups.map(group => {
        return {
          attributes: {
            name: group.groupName,
            role: group.role,
          },
        };
      });
    }
    return groups;
  }
}

module.exports = {
  getGroupsByUser,
  getUserByUsername,
  isUserAnAdminUser,
  isUserSuperAdmin,
  registerUser,
};
