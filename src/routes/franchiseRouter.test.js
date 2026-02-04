const request = require("supertest");
const app = require("../service");
const { randomName, createAdminUser } = require("./testingFunctions");

let testUser;
let testUserAuthToken;

beforeAll(async () => {
  testUser = await createAdminUser();

  const loginRes = await request(app).put("/api/auth").send(testUser);
  testUserAuthToken = loginRes.body.token;
});

async function createFranchise() {
  const expectedFranchise = {
    name: randomName(),
    admins: [{ email: testUser.email }],
  };
  const createFranchiseRes = await request(app)
    .post("/api/franchise")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(expectedFranchise);
  expect(createFranchiseRes.status).toBe(200);

  expect(createFranchiseRes.body).toMatchObject(expectedFranchise);

  return createFranchiseRes.body;
}

test("create franchise", createFranchise);

test("list franchises", async () => {
  const franchise = await createFranchise();
  const res = await request(app).get(
    `/api/franchise?page-0&limit=1&name=${franchise.name}`,
  );

  expect(res.status).toBe(200);
  expect(res.body.franchises).toEqual(
    expect.arrayContaining([
      { id: franchise.id, name: franchise.name, stores: [] },
    ]),
  );
});

test("list a user's franchises", async () => {
  const franchise = await createFranchise();
  const res = await request(app)
    .get(`/api/franchise/${testUser.id}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(res.status).toBe(200);
  expect(res.body).toContainEqual({ ...franchise, stores: [] });
});

test("delete a franchise", async () => {
  const franchise = await createFranchise();
  const res = await request(app)
    .delete(`/api/franchise/${franchise.id}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(res.status).toEqual(200);
  expect(res.body.message).toEqual("franchise deleted");
});

async function createStore() {
  const franchise = await createFranchise();
  const name = randomName();
  const res = await request(app)
    .post(`/api/franchise/${franchise.id}/store`)
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send({ franchiseId: franchise.id, name });

  expect(res.status).toEqual(200);
  expect(res.body).toMatchObject({
    id: expect.any(Number),
    franchiseId: franchise.id,
    name,
  });

  return res.body;
}

test("create a new franchise store", createStore);

test("delete a store", async () => {
  const store = createStore();
  const res = await request(app)
    .delete(`/api/franchise/${store.franchiseId}/store/:storeId`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(res.status).toEqual(200);
  expect(res.body.message).toEqual("store deleted");
});

module.exports = { createFranchise, createStore };
