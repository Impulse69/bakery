import fetch from 'node-fetch';

async function main() {
  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bakery.com', password: 'admin123' })
  });
  if (!loginRes.ok) {
    console.log('Login failed', await loginRes.text());
    return;
  }
  const { token } = await loginRes.json();
  
  const prodRes = await fetch('http://localhost:3001/api/products', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { data: products } = await prodRes.json();
  let bread = products.find(p => p.name === 'Butter Bread');
  console.log('Bread before sale:', bread.name, 'Stock:', bread.stockQuantity);

  if (bread.stockQuantity <= 0) {
    // Let's restock it via API to test
    console.log('Restocking Butter Bread to 1...');
    await fetch(`http://localhost:3001/api/products/${bread.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ stockQuantity: 1 })
    });
    bread.stockQuantity = 1;
  }

  console.log('Attempting sale of 1 Butter Bread...');
  const orderRes = await fetch('http://localhost:3001/api/sales-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      locationId: 'default',
      items: [{ productId: bread.id, quantity: 1, unitPrice: bread.price }]
    })
  });
  
  console.log('Order status:', orderRes.status);
  const order = await orderRes.json();
  console.log('Order created:', order.orderNumber);

  console.log('Attempting sale of 1 MORE Butter Bread (should fail)...');
  const orderRes2 = await fetch('http://localhost:3001/api/sales-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      locationId: 'default',
      items: [{ productId: bread.id, quantity: 1, unitPrice: bread.price }]
    })
  });
  console.log('Second order status (should be 400):', orderRes2.status);
  
  const prodRes2 = await fetch('http://localhost:3001/api/products', {
    headers: { Authorization: `Bearer ${token}` }
  });
  const { data: products2 } = await prodRes2.json();
  const bread2 = products2.find(p => p.name === 'Butter Bread');
  console.log('Bread after sale:', bread2.name, 'Stock:', bread2.stockQuantity);
}
main();