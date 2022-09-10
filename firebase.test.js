const firebase = require("@firebase/testing");
const { assertFails, assertSucceeds } = require("@firebase/testing");
const fs = require("fs");

const PROJECT_ID = "project-id"; //Your Project ID
const FIRESTORE_RULES = fs.readFileSync("firestore.rules", "utf8");

const mockData = {
  "users/edwards": {
    name: "edwards",
  },
  "users/michael": {
    name: "michael",
  },
  "posts/unitTesting": {
    name: "Unit Testing Firestore Rules",
    content: "How to unit testing Firestore Rules",
    written_by: "edwards",
  },
};

const setup = async (auth) => {
  const app = await firebase.initializeTestApp({
    projectId: PROJECT_ID,
    auth,
  });

  const db = app.firestore();

  // Initialize admin app
  const adminApp = firebase.initializeAdminApp({
    projectId: PROJECT_ID,
  });

  const adminDB = adminApp.firestore();

  // Write mock documents before rules using adminApp
  if (mockData) {
    for (const key in mockData) {
      const ref = adminDB.doc(key);
      await ref.set(mockData[key]);
    }
  }

  // Apply rules
  await firebase.loadFirestoreRules({
    projectId: PROJECT_ID,
    rules: FIRESTORE_RULES,
  });

  return db;
};

expect.extend({
  async toAllow(x) {
    let pass = false;
    try {
      await firebase.assertSucceeds(x);
      pass = true;
    } catch (err) {}

    return {
      pass,
      message: () => "Expected Firebase operation to be allowed, but it was denied",
    };
  },
});

expect.extend({
  async toDeny(x) {
    let pass = false;
    try {
      await firebase.assertFails(x);
      pass = true;
    } catch (err) {}
    return {
      pass,
      message: () => "Expected Firebase operation to be denied, but it was allowed",
    };
  },
});

describe("Database Rules", () => {
  afterAll(async () => {
    Promise.all(firebase.apps().map((app) => app.delete())); //teardown the testing environment
  });

  beforeEach(async () => {
    await firebase.clearFirestoreData({ projectId: PROJECT_ID });
  });

  test("should allow a user to update their document", async () => {
    const db = await setup({ uid: "edwards" }); //using the setup method above
    userRef = db.doc("users/edwards");
    await expect(userRef.update({})).toAllow();
  });

  test("should deny a user from updating another user document", async () => {
    const db = await setup({ uid: "michael" }); //using the setup method above
    userRef = db.doc("users/edwards");
    await expect(userRef.update({})).toDeny();
  });

  test("should allow a user to read posts", async () => {
    const db = await setup({ uid: "michael" });
    postRef = db.doc("posts/unitTesting");
    await expect(postRef.get()).toAllow();
  });

  test("should deny a user from updating posts written by another user", async () => {
    const db = await setup({ uid: "michael" });
    postRef = db.doc("posts/unitTesting");
    await expect(postRef.update({})).toDeny();
  });

  test('should allow users with the admin ROLE to update posts written by other users', async () => {
    const db = await setup({uid: 'admin', admin: true});

    postRef = db.doc('posts/unitTesting');
    await expect(postRef.update({})).toAllow();
  });
  
});
