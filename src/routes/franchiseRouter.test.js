const request = require("supertest");
const app = require("../service");
const { Role, DB } = require('../database/database.js');

function randomName() {
    return Math.random().toString(36).substring(2, 12);
}

async function createAdminUser() {
    let user = { password: 'toomanysecrets', roles: [{ role: Role.Admin }] };
    user.name = randomName();
    user.email = user.name + '@admin.com';

    user = await DB.addUser(user);
    return { ...user, password: 'toomanysecrets' };
}

let testUser;
let testUserAuthToken;

beforeAll(async () => {
    testUser = await createAdminUser();

    const loginRes = await request(app).put("/api/auth").send(testUser);
    testUserAuthToken = loginRes.body.token;
});

test("create franchise", async () => {
    const expectedFranchise = { name: randomName(), admins: [{ email: testUser.email }] }
    const createFranchiseRes = await request(app)
        .post(`/api/franchise`)
        .set("Authorization", `Bearer ${testUserAuthToken}`)
        .send(expectedFranchise);
    // expect(createFranchiseRes.status).toBe(200);

    expect(createFranchiseRes.body).toMatchObject(expectedFranchise);
});
