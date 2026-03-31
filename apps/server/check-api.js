async function checkAPI() {
  try {
    // 1. Login
    const loginRes = await fetch('http://localhost:3001/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@breadfaculty.com', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    if (!loginData.token) {
      console.log('Login failed', loginData);
      return;
    }
    
    // 2. Fetch inventory
    const invRes = await fetch('http://localhost:3001/api/inventory?limit=100', {
      headers: { 'Authorization': `Bearer ${loginData.token}` }
    });
    const inventory = await invRes.json();
    
    console.log('API Returned Total Items:', inventory.total);
    console.log('API Returned Data length:', inventory.data.length);
    if (inventory.data.length > 0) {
      console.log('First item:', inventory.data[0]);
    }
  } catch(e) {
    console.error(e);
  }
}
checkAPI();
