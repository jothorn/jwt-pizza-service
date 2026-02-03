const request = require("supertest");
const app = require("../service");

const testUser = { name: "pizza diner", email: "reg@test.com", password: "a" };
let testUserAuthToken;
let testUserId;

beforeAll(async () => {
  testUser.email = Math.random().toString(36).substring(2, 12) + "@test.com";
  const registerRes = await request(app).post("/api/auth").send(testUser);
  testUserAuthToken = registerRes.body.token;
  testUserId = registerRes.body.user.id;
});

test("get user", async () => {
  const getUserRes = await request(app)
    .get("/api/user/me")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send();
  expect(getUserRes.status).toBe(200);

  const expectedUser = { ...testUser, roles: [{ role: "diner" }] };
  delete expectedUser.password;
  expect(getUserRes.body).toMatchObject(expectedUser);
});

test("update user", async () => {
  const expectedUser = {
    ...testUser,
    roles: [{ role: "diner" }],
    name: "new name",
  };
  const updateUserRes = await request(app)
    .put(`/api/user/${testUserId}`)
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(expectedUser);
  expect(updateUserRes.status).toBe(200);

  delete expectedUser.password;
  expect(updateUserRes.body.user).toMatchObject(expectedUser);
});
