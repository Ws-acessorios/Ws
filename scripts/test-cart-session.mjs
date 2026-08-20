import assert from "node:assert/strict";
import { guestStorageKey } from "../dist/cart-session.js";

const first = guestStorageKey("guest_11111111-1111-4111-8111-111111111111");
const second = guestStorageKey("guest_22222222-2222-4222-8222-222222222222");
assert.notEqual(first, second);
assert.equal(first, guestStorageKey("guest_11111111-1111-4111-8111-111111111111"));
console.log("CART_SESSION_ISOLATION_OK");
