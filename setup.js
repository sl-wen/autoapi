const fs = require('fs');
const readline = require('readline');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('Setting up environment variables...\n');

  // Check if .env.local exists
  if (fs.existsSync('.env.local')) {
    const overwrite = await askQuestion('.env.local already exists. Overwrite? (y/N): ');
    if (overwrite.toLowerCase() !== 'y') {
      console.log('Setup cancelled.');
      rl.close();
      return;
    }
  }

  // Get API keys from user
  const openaiKey = await askQuestion('Enter your OpenAI API key (required): ');
  const hfKey = await askQuestion('Enter your HuggingFace API key (optional, press Enter to skip): ');

  // Create .env.local content
  const envContent = `# OpenAI API Key
OPENAI_API_KEY=${openaiKey}

# HuggingFace API Key
HUGGINGFACE_API_KEY=${hfKey}

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000
NODE_ENV=development
`;

  // Write to .env.local
  fs.writeFileSync('.env.local', envContent);
  console.log('\n.env.local file created successfully!');
  
  // Add .env.local to .gitignore if not already present
  const gitignorePath = '.gitignore';
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    if (!gitignore.includes('.env.local')) {
      fs.appendFileSync(gitignorePath, '\n.env.local');
      console.log('.env.local added to .gitignore');
    }
  }

  console.log('\nSetup complete! You can now start the development server with:');
  console.log('npm run dev');
  
  rl.close();
}

setup().catch(console.error);