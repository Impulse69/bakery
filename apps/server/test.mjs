import { prisma } from './dist/lib/prisma.js';

async function main() {
  const user = await prisma.user.findFirst({ where: { role: 'admin' } });
  if (!user) return console.log('no user');

  const loc = await prisma.location.findFirst({ where: { id: 'default' } });
  if (!loc) return console.log('no location');
  
  const prod = await prisma.product.findFirst();
  if (!prod) return console.log('no product');

  const loginRes = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password: 'password123' })
  });
  
  const loginData = await loginRes.json();
  const token = loginData.token;

  console.log('Got valid token. Requesting POS...');
  const res = await fetch('http://localhost:3001/api/sales-orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
    body: JSON.stringify({
      locationId: loc.id,
      items: [{ productId: prod.id, quantity: 1, unitPrice: prod.price, tax: 0 }],
      notes: 'Test POS',
    })
  });
  
  const text = await res.text();
  console.log('CREATE:', res.status, text);

  if (res.status === 201) {
    const order = JSON.parse(text);
    const pRes = await fetch('http://localhost:3001/api/sales-orders/' + order.id + '/payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify({ amount: prod.price, method: 'cash' })
    });
    console.log('PAY:', pRes.status, await pRes.text());
  }
}
main();
