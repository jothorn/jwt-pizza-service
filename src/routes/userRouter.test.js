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
  listUsersRes.body.users.forEach((user) => {
    expect(user).toHaveProperty("id");
    expect(user).toHaveProperty("name");
    expect(user).toHaveProperty("email");
    expect(user).toHaveProperty("roles");
    expect(Array.isArray(user.roles)).toBe(true);
  });
});

test("list users pagination", async () => {
  const [, userToken] = await registerUser(request(app));

  // Create additional test users to test pagination
  await registerUser(request(app), "user2@test.com");
  await registerUser(request(app), "user3@test.com");
  await registerUser(request(app), "user4@test.com");
  await registerUser(request(app), "user5@test.com");

  // Get all users to see the total count
  const allUsersRes = await request(app)
    .get("/api/user?page=1&limit=100") // Large limit to get all
    .set("Authorization", "Bearer " + userToken);
  expect(allUsersRes.status).toBe(200);
  const totalUsers = allUsersRes.body.users.length;
  expect(totalUsers).toBeGreaterThanOrEqual(6); // At least default admin + test user + 4 additional

  // Test default pagination (page=1, limit=10)
  const defaultPageRes = await request(app)
    .get("/api/user")
    .set("Authorization", "Bearer " + userToken);
  expect(defaultPageRes.status).toBe(200);
  expect(defaultPageRes.body.users.length).toBe(Math.min(10, totalUsers));
  expect(defaultPageRes.body.more).toBe(totalUsers > 10);

  // Test custom pagination with limit=2
  const page1Res = await request(app)
    .get("/api/user?page=1&limit=2")
    .set("Authorization", "Bearer " + userToken);
  expect(page1Res.status).toBe(200);
  expect(page1Res.body.users.length).toBe(2);
  expect(page1Res.body.more).toBe(totalUsers > 2);

  const page2Res = await request(app)
    .get("/api/user?page=2&limit=2")
    .set("Authorization", "Bearer " + userToken);
  expect(page2Res.status).toBe(200);
  expect(page2Res.body.users.length).toBe(
    Math.min(2, Math.max(0, totalUsers - 2)),
  );
  expect(page2Res.body.more).toBe(totalUsers > 4);

  // Test that pagination parameters are respected
  const smallLimitRes = await request(app)
    .get("/api/user?page=1&limit=1")
    .set("Authorization", "Bearer " + userToken);
  expect(smallLimitRes.status).toBe(200);
  expect(smallLimitRes.body.users.length).toBe(1);
  expect(typeof smallLimitRes.body.more).toBe("boolean");
});

test("list users name filter", async () => {
  const [, userToken] = await registerUser(
    request(app),
    "alice@test.com",
    "Alice",
  );

  // Create users with specific names for filtering
  await registerUser(request(app), "bob@test.com", "Bob");
  await registerUser(request(app), "charlie@test.com", "Charlie");
  await registerUser(request(app), "david@test.com", "David");

  // Test filtering by name - should match users starting with 'a'
  const filterARes = await request(app)
    .get("/api/user?name=a*")
    .set("Authorization", "Bearer " + userToken);
  expect(filterARes.status).toBe(200);
  expect(filterARes.body.users.length).toBeGreaterThanOrEqual(1);
  // All returned users should have names starting with 'a' (case insensitive)
  filterARes.body.users.forEach((user) => {
    expect(user.name.toLowerCase().startsWith("a")).toBe(true);
  });

  // Test filtering by name - should match users starting with 'b'
  const filterBRes = await request(app)
    .get("/api/user?name=b*")
    .set("Authorization", "Bearer " + userToken);
  expect(filterBRes.status).toBe(200);
  expect(filterBRes.body.users.length).toBeGreaterThanOrEqual(1);
  // All returned users should have names starting with 'b' (case insensitive)
  filterBRes.body.users.forEach((user) => {
    expect(user.name.toLowerCase().startsWith("b")).toBe(true);
  });

  // Test filtering with no matches
  const filterNoMatchRes = await request(app)
    .get("/api/user?name=xyz*")
    .set("Authorization", "Bearer " + userToken);
  expect(filterNoMatchRes.status).toBe(200);
  expect(filterNoMatchRes.body.users.length).toBe(0);

  // Test default wildcard (should return all users)
  const wildcardRes = await request(app)
    .get("/api/user?name=*")
    .set("Authorization", "Bearer " + userToken);
  expect(wildcardRes.status).toBe(200);
  expect(wildcardRes.body.users.length).toBeGreaterThanOrEqual(4); // At least our test users
});

async function registerUser(service, email = null, name = null) {
  const testUser = {
    name: name || "pizza diner",
    email: email || `${randomName()}@test.com`,
    password: "a",
  };
  const registerRes = await service.post("/api/auth").send(testUser);
  registerRes.body.user.password = testUser.password;

  return [registerRes.body.user, registerRes.body.token];
}

function randomName() {
  return Math.random().toString(36).substring(2, 12);
}
