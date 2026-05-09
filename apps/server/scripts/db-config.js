const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { Client } = require('pg');
const bcrypt = require('bcryptjs');
const { execSync } = require('child_process');

// ANSI escape codes for beautiful styling
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  red: '\x1b[31m',
  bgBlue: '\x1b[44m'
};

const envPath = path.resolve(__dirname, '../.env');

// Helper to prompt user
function askQuestion(query, defaultValue = '') {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    const formattedQuery = defaultValue 
      ? `${colors.bright}${query}${colors.reset} [${colors.cyan}${defaultValue}${colors.reset}]: `
      : `${colors.bright}${query}${colors.reset}: `;
    rl.question(formattedQuery, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue);
    });
  });
}

// Helper to prompt password securely
function askPassword(query) {
  if (!process.stdin.setRawMode) {
    return askQuestion(query);
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    process.stdout.write(`${colors.bright}${query}${colors.reset}: `);

    let password = '';
    const stdin = process.stdin;
    stdin.setRawMode(true);
    stdin.resume();

    const handler = (char) => {
      const charStr = char.toString();
      switch (charStr) {
        case '\n':
        case '\r':
        case '\u0004':
          stdin.setRawMode(false);
          stdin.removeListener('data', handler);
          process.stdout.write('\n');
          rl.close();
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          stdin.setRawMode(false);
          process.stdout.write('\n');
          process.exit(1);
          break;
        case '\u007f': // Backspace in some shells
        case '\b':
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += charStr;
          process.stdout.write('*');
          break;
      }
    };

    stdin.on('data', handler);
  });
}

// Helper to parse a PostgreSQL connection string
function parseConnectionString(url) {
  // Regex to extract credentials: postgresql://user:pass@host:port/database
  const regex = /^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/;
  const match = url.match(regex);
  if (!match) return null;
  return {
    user: match[1],
    password: match[2],
    host: match[3],
    port: match[4],
    database: match[5]
  };
}

// Helper to write/update environment file
function updateEnvFile(dbUrl) {
  let content = '';
  if (fs.existsSync(envPath)) {
    content = fs.readFileSync(envPath, 'utf8');
  }

  const lines = content.split(/\r?\n/);
  const updatedLines = [];
  let dbUrlUpdated = false;

  for (let line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('DATABASE_URL=')) {
      updatedLines.push(`DATABASE_URL="${dbUrl}"`);
      dbUrlUpdated = true;
    } else if (trimmed.startsWith('DIRECT_URL=')) {
      // Comment out DIRECT_URL (Supabase remote fallback) to ensure it uses local on-premise
      updatedLines.push(`# DIRECT_URL (disabled for on-premise): ${line}`);
    } else {
      updatedLines.push(line);
    }
  }

  if (!dbUrlUpdated) {
    updatedLines.push(`DATABASE_URL="${dbUrl}"`);
  }

  fs.writeFileSync(envPath, updatedLines.join('\n'), 'utf8');
  console.log(`\n${colors.green}✓ .env file updated successfully.${colors.reset}`);
}

async function main(forceNewCredentials = false) {
  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}${colors.bgBlue}    BREAD FACULTY POS - DATABASE SETUP & TROUBLESHOOTING    ${colors.reset}`);
  console.log('='.repeat(60));
  console.log('This utility configures your local database and seeds admin credentials.\n');

  // Load current .env if it exists
  let currentDbUrl = 'postgresql://postgres:0000@localhost:5432/bread_faculty';
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const dbUrlMatch = envContent.match(/DATABASE_URL=["']?([^"'\s]+)["']?/);
    if (dbUrlMatch) {
      currentDbUrl = dbUrlMatch[1];
    }
  }

  const censoredUrl = currentDbUrl.replace(/:([^@:]+)@/, ':******@');
  console.log(`Current DB URL: ${colors.yellow}${censoredUrl}${colors.reset}\n`);

  let keepCurrent = 'y';
  if (forceNewCredentials) {
    keepCurrent = 'n';
  } else {
    keepCurrent = await askQuestion('Do you want to use the current database connection settings? (y/n)', 'y');
  }
  
  let finalDbUrl = currentDbUrl;

  if (keepCurrent.toLowerCase() !== 'y') {
    console.log(`\n${colors.bright}Please enter your PostgreSQL connection details:${colors.reset}`);
    const host = await askQuestion('PostgreSQL Hostname', 'localhost');
    const port = await askQuestion('PostgreSQL Port', '5432');
    const username = await askQuestion('PostgreSQL Username', 'postgres');
    const password = await askPassword('PostgreSQL Password');
    const dbName = await askQuestion('Database Name', 'bread_faculty');

    finalDbUrl = `postgresql://${username}:${encodeURIComponent(password)}@${host}:${port}/${dbName}?schema=public`;
  }

  const parsed = parseConnectionString(finalDbUrl);
  if (!parsed) {
    console.error(`\n${colors.red}❌ Error: Invalid database URL format. Config aborted.${colors.reset}`);
    process.exit(1);
  }

  console.log(`\nTesting connection to PostgreSQL...`);
  let client = new Client({ connectionString: finalDbUrl });
  let connected = false;
  let dbDoesNotExist = false;

  try {
    await client.connect();
    await client.end();
    connected = true;
    console.log(`${colors.green}✓ Successfully connected to database: ${parsed.database}${colors.reset}`);
  } catch (err) {
    if (err.code === '3D000') {
      dbDoesNotExist = true;
      console.log(`${colors.yellow}⚠️  Database "${parsed.database}" does not exist yet.${colors.reset}`);
    } else {
      console.error(`\n${colors.red}[ERROR] Failed to connect to PostgreSQL:${colors.reset}`, err.message);
      console.log(`Please make sure PostgreSQL is running and your username/password are correct.`);
      
      const retry = await askQuestion('Would you like to try entering new credentials? (y/n)', 'y');
      if (retry.toLowerCase() === 'y') {
        return main(true);
      } else {
        console.log('Exiting configuration tool.');
        process.exit(1);
      }
    }
  }

  // Auto-create database if it does not exist
  if (dbDoesNotExist) {
    console.log(`Attempting to automatically create database "${parsed.database}"...`);
    // Connect to the default "postgres" database first
    const adminUrl = `postgresql://${parsed.user}:${parsed.password}@${parsed.host}:${parsed.port}/postgres`;
    const adminClient = new Client({ connectionString: adminUrl });
    try {
      await adminClient.connect();
      // Databases with capitals or special characters must be quoted
      await adminClient.query(`CREATE DATABASE "${parsed.database}"`);
      await adminClient.end();
      console.log(`${colors.green}✓ Successfully created database "${parsed.database}"!${colors.reset}`);
      connected = true;
    } catch (createErr) {
      console.error(`\n${colors.red}❌ Failed to auto-create database:${colors.reset}`, createErr.message);
      console.log(`Please create the database manually using pgAdmin or run a SQL command:\n  CREATE DATABASE "${parsed.database}";`);
      process.exit(1);
    }
  }

  if (!connected) {
    console.error(`\n${colors.red}❌ Cannot proceed without a valid database connection.${colors.reset}`);
    process.exit(1);
  }

  // Update .env file
  updateEnvFile(finalDbUrl);

  // ─── RUN PRISMA MIGRATIONS ──────────────────────────────────────────────────
  console.log(`\n${colors.bright}Synchronizing database tables... (This can take 10-20 seconds)${colors.reset}`);
  
  const serverDir = path.resolve(__dirname, '..');
  const nodeExe = fs.existsSync(path.join(serverDir, 'runtime', 'node.exe'))
    ? path.join(serverDir, 'runtime', 'node.exe')
    : 'node';
  const prismaCliPath = path.join(serverDir, 'node_modules', 'prisma', 'build', 'index.js');
  
  try {
    if (fs.existsSync(prismaCliPath)) {
      console.log('Generating Prisma Client...');
      execSync(`"${nodeExe}" "${prismaCliPath}" generate`, { cwd: serverDir, stdio: 'inherit' });
      
      console.log('Applying database migrations (Prisma Deploy)...');
      execSync(`"${nodeExe}" "${prismaCliPath}" migrate deploy`, { cwd: serverDir, stdio: 'inherit' });
    } else {
      console.log('Running npx prisma generate/deploy...');
      execSync('npx prisma generate', { cwd: serverDir, stdio: 'inherit' });
      execSync('npx prisma migrate deploy', { cwd: serverDir, stdio: 'inherit' });
    }
    console.log(`${colors.green}✓ Database tables synchronized successfully.${colors.reset}`);
  } catch (migrationErr) {
    console.error(`\n${colors.red}❌ Failed to apply database migrations:${colors.reset}`, migrationErr.message);
    console.log('Please check your network, environment configuration, and database privileges.');
    process.exit(1);
  }

  // ─── ADMIN USER ACCOUNT CONFIGURATION ──────────────────────────────────────
  console.log(`\n${colors.bright}Configure Administrator Account Credentials:${colors.reset}`);
  const runAdminReset = await askQuestion('Do you want to create or reset the admin credentials? (y/n)', 'y');

  if (runAdminReset.toLowerCase() === 'y') {
    const adminEmail = await askQuestion('Administrator Email Address', 'admin@bakery.com');
    const adminPassword = await askQuestion('Administrator Password', 'admin123');
    const adminName = await askQuestion('Administrator Full Name', 'Admin User');

    console.log(`\nUpdating credentials in database...`);
    const pgClient = new Client({ connectionString: finalDbUrl });
    try {
      await pgClient.connect();
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash(adminPassword, salt);
      const cuid = 'user_admin_cuid_' + Math.random().toString(36).substring(2, 15);

      // We use PostgreSQL ON CONFLICT statement to upsert the user cleanly.
      const query = `
        INSERT INTO "users" (id, name, email, "passwordHash", role, "isActive", "createdAt", "updatedAt")
        VALUES ($1, $2, $3, $4, 'admin', true, NOW(), NOW())
        ON CONFLICT (email) 
        DO UPDATE SET 
          "passwordHash" = EXCLUDED."passwordHash", 
          "name" = EXCLUDED.name, 
          "updatedAt" = NOW();
      `;

      await pgClient.query(query, [cuid, adminName, adminEmail, hash]);
      await pgClient.end();

      console.log(`\n${colors.green}🎉 SUCCESS! Admin account is set up and active.${colors.reset}`);
      console.log(`  ${colors.bright}Email:${colors.reset}    ${colors.cyan}${adminEmail}${colors.reset}`);
      console.log(`  ${colors.bright}Password:${colors.reset} ${colors.cyan}${adminPassword}${colors.reset}`);
    } catch (dbErr) {
      console.error(`\n${colors.red}❌ Failed to insert admin credentials into database:${colors.reset}`, dbErr.message);
      process.exit(1);
    }
  }

  // ─── RESTART SERVICE ────────────────────────────────────────────────────────
  console.log(`\n${colors.bright}Applying changes and starting backend background service...${colors.reset}`);
  try {
    // Attempt to stop the service first (ignoring failure if it's not started)
    try {
      execSync('net stop "Bread Faculty Server"', { stdio: 'ignore' });
    } catch (e) {}

    // Wait a brief moment
    await new Promise(r => setTimeout(r, 1000));

    // Try to start the service
    try {
      execSync('net start "Bread Faculty Server"', { stdio: 'inherit' });
      console.log(`${colors.green}✓ "Bread Faculty Server" Windows background service started successfully!${colors.reset}`);
    } catch (startErr) {
      // If service is not registered yet, run install-service.js
      console.log('Windows service is not installed/running yet. Registering service...');
      const installScript = path.join(serverDir, 'scripts', 'install-service.js');
      execSync(`"${nodeExe}" "${installScript}"`, { cwd: serverDir, stdio: 'inherit' });
    }
  } catch (serviceErr) {
    console.warn(`\n${colors.yellow}⚠️  Service restart returned an alert: ${serviceErr.message}${colors.reset}`);
    console.log('You may need to manually start the "Bread Faculty Server" service in Windows Services (services.msc).');
  }

  console.log('\n' + '='.repeat(60));
  console.log(`${colors.bright}${colors.green}                  DATABASE CONFIGURATION COMPLETE!                  ${colors.reset}`);
  console.log('='.repeat(60));
  console.log('1. PostgreSQL: ' + colors.green + 'CONNECTED & SYNCHRONIZED' + colors.reset);
  console.log('2. Server API: ' + colors.green + 'RUNNING IN BACKGROUND' + colors.reset);
  console.log('3. Client POS: ' + colors.bright + 'READY TO LOG IN' + colors.reset);
  console.log('='.repeat(60) + '\n');
}

main().catch((err) => {
  console.error('\nAn unexpected error occurred:', err);
  process.exit(1);
});
