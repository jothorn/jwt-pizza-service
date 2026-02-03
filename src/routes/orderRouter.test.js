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

test("add an item to the menu", async () => {
  const item = {
    title: "Student",
    description: "No topping, no sauce, just carbs",
    image: "pizza9.png",
    price: 0.0001,
  };
  const res = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(item);

  expect(res.status).toEqual(200);
  expect(res.body).toContainEqual({ ...item, id: expect.any(Number) });
});
