const mineflayer = require('mineflayer');
const pathfinder = require('mineflayer-pathfinder').pathfinder;
const Movements = require('mineflayer-pathfinder').Movements;
const { GoalBlock, GoalNear, GoalFollow } = require('mineflayer-pathfinder').goals;
const collectBlock = require('mineflayer-collectblock').plugin;
const { plugin: toolPlugin } = require('mineflayer-tool');
const Vec3 = require('vec3');
const axios = require('axios');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ============ CONFIGURATION ============
const CONFIG = {
  // Bot identity
  botName: 'nBot-Larry',  // Change this to whatever name you want!
  skinPath: path.join(__dirname, 'bot-skin.png'),
  
  // Minecraft server - set to Windows PC IP if Windows hosts server
  // Or use 'localhost' if Linux hosts the server
  host: '192.168.0.11',
  port: 25565,
  
  // Ollama settings
  ollamaUrl: 'http://localhost:11434/api/generate',
  ollamaModel: 'llama3.2:latest',
  
  // Behavior settings
  followDistance: 2,
  miningTimeout: 30000,
  maxSearchDistance: 64,
};

// ============ AVAILABLE ACTIONS ============
const ACTIONS = {
  COME: {
    keywords: ['come', 'here', 'follow', 'to me', 'over here', 'come here'],
    execute: async (bot, player) => {
      const playerEntity = bot.players[player]?.entity;
      if (!playerEntity) return "I can't see you!";
      
      const goal = new GoalNear(playerEntity.position.x, playerEntity.position.y, playerEntity.position.z, CONFIG.followDistance);
      bot.pathfinder.setGoal(goal);
      return "I'm on my way!";
    }
  },
  
  STOP: {
    keywords: ['stop', 'wait', 'stay', 'halt', 'pause'],
    execute: async (bot) => {
      bot.pathfinder.setGoal(null);
      bot.collectBlock.cancel();
      return "Okay, I'll stop here.";
    }
  },
  
  MINE: {
    keywords: ['mine', 'get', 'collect', 'gather', 'harvest', 'dig', 'find'],
    execute: async (bot, player, message) => {
      const blocks = parseBlockTypes(message);
      if (blocks.length === 0) return "What should I mine?";
      
      const results = [];
      for (const blockType of blocks) {
        try {
          const result = await mineBlockType(bot, blockType);
          results.push(result);
        } catch (err) {
          results.push(`Couldn't mine ${blockType}: ${err.message}`);
        }
      }
      return results.join('\n');
    }
  },
  
  CRAFT: {
    keywords: ['craft', 'make', 'create', 'build', 'prepare'],
    execute: async (bot, player, message) => {
      const items = parseCraftableItems(message);
      if (items.length === 0) return "What should I craft?";
      
      const results = [];
      for (const item of items) {
        try {
          const result = await craftItem(bot, item);
          results.push(result);
        } catch (err) {
          results.push(`Couldn't craft ${item}: ${err.message}`);
        }
      }
      return results.join('\n');
    }
  },
  
  GIVE: {
    keywords: ['give', 'hand', 'pass', 'drop', 'throw'],
    execute: async (bot, player, message) => {
      const playerEntity = bot.players[player]?.entity;
      if (!playerEntity) return "I can't see you to give you items!";
      
      const items = parseItemTypes(message);
      if (items.length === 0) {
        // Try to give everything if no specific item mentioned
        const results = [];
        for (const item of bot.inventory.items()) {
          await bot.tossStack(item);
          results.push(`Dropped ${item.name} x${item.count}`);
        }
        return results.length > 0 ? results.join('\n') : "I don't have anything to give!";
      }
      
      const results = [];
      for (const itemType of items) {
        const itemsToGive = bot.inventory.items().filter(i => i.name.includes(itemType.toLowerCase()));
        for (const item of itemsToGive) {
          await bot.tossStack(item);
          results.push(`Gave you ${item.name} x${item.count}`);
        }
      }
      return results.length > 0 ? results.join('\n') : `I don't have any ${items.join(', ')}!`;
    }
  },
  
  EQUIP: {
    keywords: ['equip', 'hold', 'wear', 'put on'],
    execute: async (bot, player, message) => {
      const items = parseItemTypes(message);
      if (items.length === 0) return "What should I equip?";
      
      for (const itemType of items) {
        const item = bot.inventory.items().find(i => i.name.includes(itemType.toLowerCase()));
        if (item) {
          await bot.equip(item, 'hand');
          return `Equipped ${item.name}`;
        }
      }
      return `I don't have any of those items!`;
    }
  },
  
  INVENTORY: {
    keywords: ['inventory', 'what do you have', 'items', 'carrying', 'what\'s in your'],
    execute: async (bot) => {
      const items = bot.inventory.items();
      if (items.length === 0) return "My inventory is empty!";
      
      const itemList = items.map(i => `${i.name} x${i.count}`).join(', ');
      return `I have: ${itemList}`;
    }
  },
  
  STATUS: {
    keywords: ['status', 'how are you', 'health', 'hunger', 'hp'],
    execute: async (bot) => {
      const health = Math.round(bot.health);
      const food = Math.round(bot.food);
      const pos = bot.entity.position;
      return `Health: ${health}/20, Hunger: ${food}/20, Position: ${Math.round(pos.x)}, ${Math.round(pos.y)}, ${Math.round(pos.z)}`;
    }
  },
  
  SLEEP: {
    keywords: ['sleep', 'bed', 'rest'],
    execute: async (bot) => {
      const bed = bot.findBlock({
        matching: block => block.name.includes('bed'),
        maxDistance: 32
      });
      
      if (!bed) {
        // Try to craft a bed if we have wool and planks
        try {
          await craftItem(bot, 'bed');
          return "I crafted a bed! Place it down and I'll sleep.";
        } catch {
          return "I can't find a bed nearby and don't have materials to make one.";
        }
      }
      
      try {
        await bot.sleep(bed);
        return "Goodnight!";
      } catch (err) {
        return `Can't sleep: ${err.message}`;
      }
    }
  },
  
  WAKE: {
    keywords: ['wake', 'get up', 'rise'],
    execute: async (bot) => {
      try {
        bot.wake();
        return "Good morning!";
      } catch {
        return "I'm not sleeping!";
      }
    }
  }
};

// ============ UTILITY FUNCTIONS ============

function parseBlockTypes(message) {
  const commonBlocks = [
    'stone', 'dirt', 'wood', 'log', 'planks', 'cobblestone', 'iron', 'gold', 'diamond',
    'coal', 'redstone', 'lapis', 'emerald', 'sand', 'gravel', 'clay', 'obsidian',
    'oak', 'birch', 'spruce', 'jungle', 'acacia', 'dark_oak'
  ];
  
  const found = [];
  for (const block of commonBlocks) {
    if (message.toLowerCase().includes(block)) {
      found.push(block);
    }
  }
  
  // Check for generic terms
  if (message.toLowerCase().includes('tree') || message.toLowerCase().includes('wood')) {
    if (!found.includes('log')) found.push('log');
  }
  
  return found;
}

function parseCraftableItems(message) {
  const craftables = [
    'pickaxe', 'axe', 'shovel', 'hoe', 'sword', 'crafting_table', 'furnace', 'chest',
    'bed', 'door', 'planks', 'sticks', 'torch', 'ladder', 'fence', 'boat', 'bowl',
    'bucket', 'clock', 'compass', 'fishing_rod', 'flint_and_steel', 'shears', 'shield',
    'stone', 'bricks', 'glass', 'paper', 'book', 'bookshelf', 'bread', 'cookie',
    'cake', 'pumpkin_pie', 'sugar', 'wooden_pickaxe', 'stone_pickaxe', 'iron_pickaxe',
    'diamond_pickaxe', 'golden_pickaxe', 'netherite_pickaxe'
  ];
  
  const found = [];
  for (const item of craftables) {
    if (message.toLowerCase().includes(item.replace('_', ' ')) || 
        message.toLowerCase().includes(item)) {
      found.push(item);
    }
  }
  
  return found;
}

function parseItemTypes(message) {
  const items = [
    'stone', 'dirt', 'wood', 'planks', 'pickaxe', 'axe', 'sword', 'shovel',
    'food', 'bread', 'meat', 'iron', 'gold', 'diamond', 'coal', 'torch'
  ];
  
  const found = [];
  for (const item of items) {
    if (message.toLowerCase().includes(item)) {
      found.push(item);
    }
  }
  return found;
}

async function mineBlockType(bot, blockType) {
  // Find the block
  const mcData = require('minecraft-data')(bot.version);
  const blockIds = mcData.blocksArray
    .filter(b => b.name.toLowerCase().includes(blockType.toLowerCase()))
    .map(b => b.id);
  
  if (blockIds.length === 0) {
    // Try to find logs if wood is requested
    if (blockType === 'wood' || blockType === 'log') {
      const logIds = mcData.blocksArray
        .filter(b => b.name.includes('log') || b.name.includes('stem'))
        .map(b => b.id);
      blockIds.push(...logIds);
    }
  }
  
  const block = bot.findBlock({
    matching: blockIds,
    maxDistance: CONFIG.maxSearchDistance
  });
  
  if (!block) {
    // Check if we need to craft a tool first
    const toolNeeded = getToolForBlock(blockType);
    if (toolNeeded) {
      try {
        await craftToolIfNeeded(bot, toolNeeded);
        // Re-search after crafting
        const newBlock = bot.findBlock({
          matching: blockIds,
          maxDistance: CONFIG.maxSearchDistance
        });
        if (newBlock) {
          await bot.collectBlock.collect(newBlock);
          return `Mined ${blockType} after crafting a ${toolNeeded}!`;
        }
      } catch (err) {
        return `Couldn't find ${blockType} nearby and couldn't craft tool: ${err.message}`;
      }
    }
    return `Couldn't find any ${blockType} nearby!`;
  }
  
  // Equip appropriate tool
  const tool = getToolForBlock(blockType);
  if (tool) {
    await equipBestTool(bot, tool);
  }
  
  // Mine the block
  await bot.collectBlock.collect(block);
  return `Mined some ${blockType}!`;
}

function getToolForBlock(blockType) {
  if (blockType.includes('stone') || blockType.includes('ore') || blockType.includes('coal') || 
      blockType.includes('iron') || blockType.includes('gold') || blockType.includes('diamond')) {
    return 'pickaxe';
  }
  if (blockType.includes('wood') || blockType.includes('log')) {
    return 'axe';
  }
  if (blockType.includes('dirt') || blockType.includes('sand') || blockType.includes('gravel')) {
    return 'shovel';
  }
  return null;
}

async function equipBestTool(bot, toolType) {
  const tools = bot.inventory.items()
    .filter(i => i.name.includes(toolType))
    .sort((a, b) => getToolTier(b.name) - getToolTier(a.name));
  
  if (tools.length > 0) {
    await bot.equip(tools[0], 'hand');
  }
}

function getToolTier(toolName) {
  if (toolName.includes('netherite')) return 6;
  if (toolName.includes('diamond')) return 5;
  if (toolName.includes('iron')) return 4;
  if (toolName.includes('stone')) return 3;
  if (toolName.includes('wooden') || toolName.includes('gold')) return 2;
  return 1;
}

async function craftToolIfNeeded(bot, toolType) {
  // Check if we already have the tool
  const hasTool = bot.inventory.items().some(i => i.name.includes(toolType));
  if (hasTool) return;
  
  // Try to craft a basic wooden tool first
  try {
    await craftItem(bot, `wooden_${toolType}`);
  } catch {
    // If wooden fails, try stone
    try {
      await craftItem(bot, `stone_${toolType}`);
    } catch {
      throw new Error(`Cannot craft ${toolType}`);
    }
  }
}

async function craftItem(bot, itemName) {
  const mcData = require('minecraft-data')(bot.version);
  const item = mcData.itemsByName[itemName];
  
  if (!item) {
    throw new Error(`Unknown item: ${itemName}`);
  }
  
  const recipe = bot.recipesFor(item.id, null, 1, null)[0];
  
  if (!recipe) {
    throw new Error(`No recipe found for ${itemName}`);
  }
  
  // Check if we need a crafting table
  const requiresTable = recipe.requiresTable;
  if (requiresTable) {
    const hasTable = bot.inventory.items().some(i => i.name === 'crafting_table');
    if (!hasTable) {
      // Try to craft a crafting table
      try {
        const tableRecipe = bot.recipesFor(mcData.itemsByName['crafting_table'].id, null, 1, null)[0];
        if (tableRecipe) {
          await bot.craft(tableRecipe);
          bot.chat("I crafted a crafting table!");
        }
      } catch (err) {
        throw new Error(`Need crafting table but can't make one: ${err.message}`);
      }
    }
    
    // Find or place crafting table
    let table = bot.findBlock({
      matching: mcData.blocksByName['crafting_table']?.id,
      maxDistance: 4
    });
    
    if (!table) {
      const tableItem = bot.inventory.items().find(i => i.name === 'crafting_table');
      if (tableItem) {
        // Place the table near us
        const pos = bot.entity.position.clone();
        pos.y = Math.floor(pos.y);
        const referenceBlock = bot.blockAt(pos.offset(0, -1, 0));
        if (referenceBlock) {
          await bot.equip(tableItem, 'hand');
          await bot.placeBlock(referenceBlock, new Vec3(0, 1, 0));
          table = bot.blockAt(pos);
        }
      }
    }
    
    if (table) {
      await bot.craft(recipe, 1, table);
    } else {
      throw new Error("Couldn't place crafting table");
    }
  } else {
    await bot.craft(recipe, 1);
  }
  
  return `Crafted ${itemName}!`;
}

// ============ OLLAMA INTEGRATION ============

async function getEnvironmentInfo(bot) {
  const pos = bot.entity.position;
  const nearbyBlocks = [];
  const nearbyEntities = [];
  
  // Scan surrounding area
  for (let x = -5; x <= 5; x++) {
    for (let y = -3; y <= 5; y++) {
      for (let z = -5; z <= 5; z++) {
        const blockPos = pos.offset(x, y, z);
        const block = bot.blockAt(blockPos);
        if (block && block.name !== 'air' && !block.name.includes('grass') && !block.name.includes('dirt')) {
          const distance = blockPos.distanceTo(pos);
          if (distance < 10 && !nearbyBlocks.some(b => b.name === block.name)) {
            nearbyBlocks.push({ name: block.name, distance: Math.round(distance) });
          }
        }
      }
    }
  }
  
  // Get nearby entities
  for (const entity of Object.values(bot.entities)) {
    if (entity !== bot.entity && entity.position.distanceTo(pos) < 20) {
      const type = entity.name || entity.type || 'unknown';
      const distance = Math.round(entity.position.distanceTo(pos));
      nearbyEntities.push({ type, distance });
    }
  }
  
  // Get held item
  const heldItem = bot.heldItem ? bot.heldItem.name : 'nothing';
  
  return {
    position: { x: Math.round(pos.x), y: Math.round(pos.y), z: Math.round(pos.z) },
    health: Math.round(bot.health),
    food: Math.round(bot.food),
    heldItem,
    nearbyBlocks: nearbyBlocks.slice(0, 8),
    nearbyEntities: nearbyEntities.slice(0, 5),
    timeOfDay: getTimeOfDay(bot)
  };
}

function getTimeOfDay(bot) {
  const time = bot.time.timeOfDay;
  if (time >= 0 && time < 1000) return 'dawn';
  if (time >= 1000 && time < 12000) return 'day';
  if (time >= 12000 && time < 13000) return 'dusk';
  return 'night';
}

async function queryOllama(prompt, systemPrompt = '') {
  try {
    const response = await axios.post(CONFIG.ollamaUrl, {
      model: CONFIG.ollamaModel,
      prompt: prompt,
      system: systemPrompt || `You are ${CONFIG.botName}, an AI assistant controlling a Minecraft bot. You are NOT a character or person - you are an AI that can perceive the Minecraft world and control a bot to help the player.

You can:
- See blocks, items, and entities around you (I'll provide this info)
- Mine, craft, build, and move
- Access your inventory
- Respond to questions about the game world factually

Respond as an AI assistant would - helpful, direct, and aware of your capabilities. Don't roleplay as a human. If you see something, say you see it. If you don't know, say so.`,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 200
      }
    }, {
      timeout: 30000
    });
    
    return response.data.response.trim();
  } catch (error) {
    console.error('Ollama error:', error.message);
    return "I'm having trouble thinking right now...";
  }
}

async function processCommand(bot, username, message) {
  // Check for action triggers
  const triggeredActions = [];
  
  for (const [actionName, action] of Object.entries(ACTIONS)) {
    for (const keyword of action.keywords) {
      if (message.toLowerCase().includes(keyword.toLowerCase())) {
        triggeredActions.push(actionName);
        break;
      }
    }
  }
  
  // Execute triggered actions
  const actionResults = [];
  for (const actionName of triggeredActions) {
    try {
      const result = await ACTIONS[actionName].execute(bot, username, message);
      actionResults.push(result);
    } catch (err) {
      console.error(`Action ${actionName} failed:`, err);
      actionResults.push(`Failed to ${actionName.toLowerCase()}`);
    }
  }
  
  // Generate AI response
  const actionContext = actionResults.length > 0 
    ? `\n[Actions performed: ${actionResults.join('; ')}]` 
    : '';
  
  // Get environment info to share with AI
  const envInfo = await getEnvironmentInfo(bot);
  const envContext = `\n[ENVIRONMENT: Position ${envInfo.position.x},${envInfo.position.y},${envInfo.position.z} | Health ${envInfo.health}/20 | Hunger ${envInfo.food}/20 | Time: ${envInfo.timeOfDay} | Holding: ${envInfo.heldItem} | Nearby blocks: ${envInfo.nearbyBlocks.map(b => b.name).join(', ') || 'none notable'} | Nearby entities: ${envInfo.nearbyEntities.map(e => e.type).join(', ') || 'none'}]`;
  
  const prompt = `Player "${username}" says: "${message}"${actionContext}${envContext}\n\nRespond as an AI assistant controlling a Minecraft bot. You can see the environment above. If asked about something you can see, confirm it. If asked to do something, evaluate if it's possible based on your capabilities and surroundings. Be direct and helpful, not roleplay-y.`;
  
  const aiResponse = await queryOllama(prompt);
  
  return aiResponse;
}

// ============ BOT SETUP ============

const bot = mineflayer.createBot({
  host: CONFIG.host,
  port: CONFIG.port,
  username: CONFIG.botName,
  skin: CONFIG.skinPath
});

bot.loadPlugin(pathfinder);
bot.loadPlugin(collectBlock);
bot.loadPlugin(toolPlugin);

// Console input for testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// ============ EVENT HANDLERS ============

bot.on('spawn', () => {
  console.log(`${CONFIG.botName} has spawned!`);
  
  const mcData = require('minecraft-data')(bot.version);
  const defaultMove = new Movements(bot, mcData);
  bot.pathfinder.setMovements(defaultMove);
});

bot.on('chat', async (username, message) => {
  // Ignore own messages and non-player messages
  if (username === CONFIG.botName) return;
  if (!bot.players[username]) return;
  
  // Check if message is directed at the bot
  const lowerMsg = message.toLowerCase();
  const botNameLower = CONFIG.botName.toLowerCase();
  const shortName = botNameLower.replace('nbot-', ''); // Extract "larry" from "nbot-larry"
  
  const isAddressed = lowerMsg.includes(botNameLower) ||
                      lowerMsg.includes(shortName) ||
                      lowerMsg.includes('bot') ||
                      lowerMsg.includes('alex') ||
                      message.startsWith('!');
  
  console.log(`[DEBUG] Message from ${username}: "${message}" | isAddressed: ${isAddressed} | keywords: ${botNameLower}, ${shortName}, bot, alex`);
  
  if (!isAddressed && !lowerMsg.includes('hey') && !lowerMsg.includes('hi')) {
    console.log(`[DEBUG] Ignoring message - not addressed to bot`);
    return;
  }
  
  console.log(`[${username}]: ${message}`);
  
  // Process the command
  try {
    const response = await processCommand(bot, username, message);
    console.log(`[DEBUG] Responding: "${response}"`);
    bot.chat(response);
  } catch (err) {
    console.error(`[ERROR] Failed to process: ${err.message}`);
    bot.chat("I'm having trouble processing that...");
  }
});

bot.on('whisper', async (username, message) => {
  console.log(`[Whisper from ${username}]: ${message}`);
  const response = await processCommand(bot, username, message);
  bot.whisper(username, response);
});

bot.on('error', (err) => {
  console.error('Bot error:', err);
});

bot.on('kicked', (reason) => {
  console.log('Kicked:', reason);
});

bot.on('death', () => {
  console.log('I died! Respawning...');
  bot.chat('Ouch! I died, but I\'ll be back!');
});

bot.on('physicTick', () => {
  // Keep the bot from starving
  if (bot.food < 16) {
    const food = bot.inventory.items().find(item => 
      item.name.includes('bread') || 
      item.name.includes('cooked') ||
      item.name.includes('apple')
    );
    if (food) {
      bot.equip(food, 'hand').then(() => bot.consume());
    }
  }
});

// Console commands for debugging
rl.on('line', async (input) => {
  if (input.startsWith('say ')) {
    bot.chat(input.slice(4));
  } else if (input === 'inv') {
    const items = bot.inventory.items().map(i => `${i.name} x${i.count}`).join(', ');
    console.log('Inventory:', items || 'Empty');
  } else if (input === 'pos') {
    const pos = bot.entity.position;
    console.log(`Position: ${pos.x.toFixed(2)}, ${pos.y.toFixed(2)}, ${pos.z.toFixed(2)}`);
  } else if (input === 'status') {
    console.log(`Health: ${bot.health}/20, Food: ${bot.food}/20`);
  } else if (input === 'help') {
    console.log('Commands: say <msg>, inv, pos, status, quit');
  } else if (input === 'quit') {
    bot.end();
    process.exit(0);
  }
});

console.log(`${CONFIG.botName} starting...`);
console.log(`Connecting to ${CONFIG.host}:${CONFIG.port}`);
console.log(`Ollama model: ${CONFIG.ollamaModel}`);
console.log('Type "help" for console commands');
