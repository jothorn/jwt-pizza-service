const request = require("supertest");
const app = require("../service");
const { randomName, createAdminUser } = require("./testingFunctions");

let testUser;
let testUserAuthToken;

const item = {
  title: "Student",
  description: "No topping, no sauce, just carbs",
  image: "pizza9.png",
  price: 0.0001,
};

beforeAll(async () => {
  testUser = await createAdminUser();

  const loginRes = await request(app).put("/api/auth").send(testUser);
  testUserAuthToken = loginRes.body.token;
});

async function addItem() {
  const res = await request(app)
    .put("/api/order/menu")
    .set("Authorization", `Bearer ${testUserAuthToken}`)
    .send(item);

  expect(res.status).toEqual(200);
  expect(res.body).toContainEqual({ ...item, id: expect.any(Number) });
}

test("add an item to the menu", addItem);

test("get the pizza menu", async () => {
  await addItem();
  const res = await request(app).get("/api/order/menu");

  expect(res.status).toEqual(200);
  expect(res.body).toContainEqual({ ...item, id: expect.any(Number) });
});
