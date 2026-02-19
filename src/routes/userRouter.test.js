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

test("list users unauthorized", async () => {
  const listUsersRes = await request(app).get("/api/user");
  expect(listUsersRes.status).toBe(401);
});

test("list users", async () => {
  const [, userToken] = await registerUser(request(app));
  const listUsersRes = await request(app)
    .get("/api/user")
    .set("Authorization", "Bearer " + userToken);
  expect(listUsersRes.status).toBe(200);

  // Check response structure
  expect(listUsersRes.body).toHaveProperty("users");
  expect(Array.isArray(listUsersRes.body.users)).toBe(true);

  // Should have at least the test user and default admin
  expect(listUsersRes.body.users.length).toBeGreaterThanOrEqual(2);

  // Check that each user has the required fields
  listUsersRes.body.users.forEach(user => {
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("name");
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("roles");
    expect(Array.isArray(user.roles)).toBe(true);
  });
});

async function registerUser(service) {
  const testUser = {
    name: "pizza diner",
    email: `${randomName()}@test.com`,
    password: "a",
  };
  const registerRes = await service.post("/api/auth").send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}
