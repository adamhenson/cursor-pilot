#!/usr/bin/env node

/**
 * Mock cursor-agent script for E2E testing
 * Simulates Cursor CLI behavior with various prompts and responses
 */

const readline = require('node:readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

// Simulate different scenarios based on command line arguments
const scenario = process.argv[2] || 'basic';

console.log('Mock Cursor Agent started...\n');

switch (scenario) {
  case 'basic':
    runBasicScenario();
    break;
  case 'questions':
    runQuestionsScenario();
    break;
  case 'approval':
    runApprovalScenario();
    break;
  case 'completion':
    runCompletionScenario();
    break;
  case 'error':
    runErrorScenario();
    break;
  case 'idle':
    runIdleScenario();
    break;
  default:
    console.log('Unknown scenario:', scenario);
    process.exit(1);
}

function runBasicScenario() {
  console.log('Welcome to Cursor!');
  console.log('What would you like to do?');
  console.log('1. Create a new project');
  console.log('2. Open existing project');
  console.log('3. Exit');
  console.log('Choose an option (1-3):');

  rl.on('line', (input) => {
    const choice = input.trim();
    switch (choice) {
      case '1':
        console.log('Creating new project...');
        console.log('Project created successfully!');
        rl.close();
        break;
      case '2':
        console.log('Opening existing project...');
        console.log('Project opened successfully!');
        rl.close();
        break;
      case '3':
        console.log('Goodbye!');
        rl.close();
        break;
      default:
        console.log('Invalid choice. Please enter 1, 2, or 3.');
        console.log('Choose an option (1-3):');
    }
  });
}

function runQuestionsScenario() {
  console.log('Starting interactive session...');

  setTimeout(() => {
    console.log('What type of project would you like to create?');
    console.log('1. React App');
    console.log('2. Node.js API');
    console.log('3. Python Script');
    console.log('Choose an option (1-3):');

    rl.on('line', (input) => {
      const choice = input.trim();
      console.log(`Selected option ${choice}`);

      setTimeout(() => {
        console.log('Would you like to install dependencies? [y/n]');

        rl.on('line', (input) => {
          const answer = input.trim().toLowerCase();
          if (answer === 'y' || answer === 'yes') {
            console.log('Installing dependencies...');
            console.log('Dependencies installed successfully!');
          } else {
            console.log('Skipping dependency installation.');
          }

          setTimeout(() => {
            console.log('✅ Project setup complete!');
            rl.close();
          }, 1000);
        });
      }, 1000);
    });
  }, 1000);
}

function runApprovalScenario() {
  console.log('Running command: npm install');
  console.log('Not in allowlist: npm install');
  console.log('Run (y) (enter)');

  rl.on('line', (input) => {
    const answer = input.trim().toLowerCase();
    if (answer === 'y' || answer === 'yes' || answer === '') {
      console.log('Command approved. Running...');
      console.log('Command completed successfully!');
    } else {
      console.log('Command cancelled.');
    }
    rl.close();
  });
}

function runCompletionScenario() {
  console.log('Starting project generation...');

  setTimeout(() => {
    console.log('Generating files...');
    console.log('✅ All tasks completed.');
    rl.close();
  }, 2000);
}

function runErrorScenario() {
  console.log('Starting operation...');

  setTimeout(() => {
    console.log('Error: Command failed');
    console.log('Would you like to retry? [y/n]');

    rl.on('line', (input) => {
      const answer = input.trim().toLowerCase();
      if (answer === 'y' || answer === 'yes') {
        console.log('Retrying...');
        console.log('✅ Operation completed successfully!');
      } else {
        console.log('Operation cancelled.');
      }
      rl.close();
    });
  }, 1000);
}

function runIdleScenario() {
  console.log('Starting idle test...');

  setTimeout(() => {
    console.log('Waiting for input...');
    console.log('Enter your name:');

    rl.on('line', (input) => {
      const name = input.trim();
      if (name) {
        console.log(`Hello, ${name}!`);
        console.log('✅ Idle test completed.');
      } else {
        console.log('Please enter a valid name.');
        console.log('Enter your name:');
      }
      rl.close();
    });
  }, 1000);
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nMock Cursor Agent terminated.');
  rl.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nMock Cursor Agent terminated.');
  rl.close();
  process.exit(0);
});
