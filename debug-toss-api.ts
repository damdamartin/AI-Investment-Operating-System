/**
 * Debug script to test Toss API authentication and prices endpoint.
 * Run with: npx ts-node --esm debug-toss-api.ts
 */

const TOSS_BASE_URL = process.env.TOSS_API_BASE_URL || "https://openapi.tossinvest.com";
const CLIENT_ID = process.env.TOSS_CLIENT_ID || "";
const CLIENT_SECRET = process.env.TOSS_CLIENT_SECRET || "";

async function debugTossApi() {
  console.log("🔍 Debugging Toss API Integration");
  console.log("=".repeat(50));
  console.log(`Base URL: ${TOSS_BASE_URL}`);
  console.log(`Client ID: ${CLIENT_ID ? "✓ Set (length: " + CLIENT_ID.length + ")" : "✗ Not set"}`);
  console.log(`Client Secret: ${CLIENT_SECRET ? "✓ Set (length: " + CLIENT_SECRET.length + ")" : "✗ Not set"}`);
  console.log("=".repeat(50));

  if (!CLIENT_ID || !CLIENT_SECRET) {
    console.error("❌ Missing Toss credentials. Set TOSS_CLIENT_ID and TOSS_CLIENT_SECRET.");
    process.exit(1);
  }

  try {
    // Test 1: OAuth2 Token Request
    console.log("\n📝 Test 1: OAuth2 Token Request");
    console.log("-".repeat(50));

    const tokenUrl = new URL("/oauth2/token", TOSS_BASE_URL).toString();
    const tokenBody = new URLSearchParams({
      grant_type: "client_credentials",
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET
    }).toString();

    console.log(`POST ${tokenUrl}`);
    console.log(`Content-Type: application/x-www-form-urlencoded`);
    console.log(`Body: ${tokenBody}`);

    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: tokenBody
    });

    console.log(`Status: ${tokenResponse.status} ${tokenResponse.statusText}`);

    const tokenData = await tokenResponse.json();
    console.log(`Response: ${JSON.stringify(tokenData, null, 2)}`);

    if (!tokenResponse.ok) {
      console.error("❌ Token request failed!");
      return;
    }

    const accessToken = tokenData.access_token;
    if (!accessToken) {
      console.error("❌ No access_token in response!");
      return;
    }

    console.log("✅ Token obtained successfully");

    // Test 2: Market Prices Request
    console.log("\n📝 Test 2: Market Prices Request");
    console.log("-".repeat(50));

    const symbols = ["005930", "000660"];
    const pricesUrl = new URL("/api/v1/prices", TOSS_BASE_URL);
    pricesUrl.searchParams.set("symbols", symbols.join(","));

    console.log(`GET ${pricesUrl.toString()}`);
    console.log(`Authorization: Bearer ${accessToken.slice(0, 10)}...`);

    const pricesResponse = await fetch(pricesUrl.toString(), {
      method: "GET",
      headers: { authorization: `Bearer ${accessToken}` }
    });

    console.log(`Status: ${pricesResponse.status} ${pricesResponse.statusText}`);

    const pricesData = await pricesResponse.json();
    console.log(`Response: ${JSON.stringify(pricesData, null, 2)}`);

    if (!pricesResponse.ok) {
      console.error("❌ Prices request failed!");
      return;
    }

    console.log("✅ Prices obtained successfully");

    // Test 3: Verify Response Format
    console.log("\n📝 Test 3: Response Format Validation");
    console.log("-".repeat(50));

    if (!Array.isArray(pricesData)) {
      console.error("❌ Expected array response, got:", typeof pricesData);
      return;
    }

    console.log(`✅ Response is an array with ${pricesData.length} items`);

    if (pricesData.length > 0) {
      const item = pricesData[0];
      console.log(`First item keys: ${Object.keys(item).join(", ")}`);
      console.log(`First item: ${JSON.stringify(item, null, 2)}`);
    }
  } catch (error) {
    console.error("❌ Error:", error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

debugTossApi().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
