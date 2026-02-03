const request = require("supertest");
const app = require("../service");
const { Role, DB } = require("../database/database.js");

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
  let user = { password: "toomanysecrets", roles: [{ role: Role.Admin }] };
  user.name = randomName();
  user.email = user.name + "@admin.com";

  user = await DB.addUser(user);
  return { ...user, password: "toomanysecrets" };
}

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
  const expected = await createFranchise();
  const res = await request(app).get(
    `/api/franchise?page-0&limit=1&name=${expected.name}`,
  );

  expect(res.status).toBe(200);
  expect(res.body.franchises).toEqual(
    expect.arrayContaining([
      { id: expected.id, name: expected.name, stores: [] },
    ]),
  );
});

test("list a user's franchises", async () => {
  const expected = await createFranchise();
  const res = await request(app)
    .get(`/api/franchise/${testUser.id}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`);

  expect(res.status).toBe(200);
  expect(res.body).toEqual(
    expect.arrayContaining([{ ...expected, stores: [] }]),
  );
});
