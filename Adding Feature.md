# Adding a Feature to APITable: A Step-by-Step Guide

This guide documents the process of adding the "Split Transactions" feature to APITable, serving as a template for implementing similar features.

## Overview of the Task

**Goal**: Add a button to the toolbar that automatically splits transaction records with multiple products into individual records with proportionally split amounts.

## Step 1: Understanding the Codebase Structure

### Key Directories to Explore:
- `packages/core/` - Core business logic, types, and constants
- `packages/datasheet/src/pc/components/` - Frontend React components
- `packages/i18n-lang/` - Internationalization strings

### Initial Context Gathering

1. **Found the toolbar component**: `packages/datasheet/src/pc/components/tool_bar/tool_bar.tsx`
   - Used `grep_search` for "Insert record" to find where buttons are added
   - Located at line 554-563 where the Insert record button is defined

2. **Understood the button pattern**:
   ```tsx
   <ToolItem
     showLabel={showIconBarLabel}
     disabled={!permissions.rowCreatable}
     className={styles.toolbarItem}
     onClick={appendRecord}
     icon={<AddCircleOutlined size={16} color={colors.secondLevelText} className={styles.toolIcon} />}
     text={isGanttView ? t(Strings.gantt_add_record) : t(Strings.insert_record)}
     id={'toolInsertRecord'}
   />
   ```

## Step 2: Adding DOM Constants

### File: `packages/core/src/config/dom_id/datasheet_id.ts`

1. Found existing toolbar constants by searching for `TOOL_BAR`
2. Added new constant after line 97:
   ```typescript
   export const TOOL_BAR_SPLIT_TRANSACTIONS = PREFIX + 'TOOL_BAR_SPLIT_TRANSACTIONS'; // Toolbar - split transactions
   ```

## Step 3: Adding Internationalization Strings

### Files Modified:
- `packages/i18n-lang/src/config/strings.en-US.json`
- `packages/i18n-lang/src/config/strings.zh-CN.json`

1. Found where to add by searching for `"insert_record":` 
2. Added after the insert_record entry:
   ```json
   "split_transactions": "Split Transactions",  // English
   "split_transactions": "拆分交易",           // Chinese
   ```

## Step 4: Understanding Data Access Patterns

### Key Imports and Selectors Used:
```typescript
import { Message } from 'pc/components/common';
import {
  CollaCommandName,
  DATASHEET_ID,
  Events,
  ExecuteResult,
  FieldType,
  // ... other imports
  Selectors,
  // ...
} from '@apitable/core';
```

### Data Access Methods:
- `Selectors.getCurrentView(state)` - Get current view
- `Selectors.getSnapshot(state)` - Get datasheet snapshot with all records
- `Selectors.getVisibleRows(state)` - Get visible rows in current view
- `Selectors.getFieldMap(state, datasheetId)` - Get field definitions (already available as `fieldMap`)

## Step 5: Implementing the Core Functionality

### File: `packages/datasheet/src/pc/components/tool_bar/tool_bar.tsx`

1. **Added the splitTransactions function** (after appendRecord function ~line 254):

```typescript
const splitTransactions = () => {
  const state = store.getState();
  const view = Selectors.getCurrentView(state)!;
  const snapshot = Selectors.getSnapshot(state)!;
  const visibleRows = Selectors.getVisibleRows(state);
  
  // Find fields by name and type
  let productsFieldId: string | null = null;
  let reconciledFieldId: string | null = null;
  let amountFieldId: string | null = null;
  let txidFieldId: string | null = null;
  
  // Search through fieldMap (already available in component)
  for (const [fieldId, field] of Object.entries(fieldMap)) {
    if (field.name === 'Products' && field.type === FieldType.OneWayLink) {
      productsFieldId = fieldId;
    } else if (field.name === 'Reconciled' && field.type === FieldType.Checkbox) {
      reconciledFieldId = fieldId;
    } else if (field.name === 'Amount' && field.type === FieldType.Number) {
      amountFieldId = fieldId;
    } else if (field.name === 'TXID' && field.type === FieldType.SingleText) {
      txidFieldId = fieldId;
    }
  }
  
  // Validation with user feedback
  if (!productsFieldId) {
    Message.warning({ content: 'Products field not found...' });
    return;
  }
  
  // Process records...
};
```

2. **Key Implementation Details**:

   a. **Finding Records to Split**:
   ```typescript
   visibleRows.forEach((row, index) => {
     const record = snapshot.recordMap[row.recordId];
     const productsValue = record.data[productsFieldId] as string[];
     const reconciledValue = reconciledFieldId ? record.data[reconciledFieldId] as boolean : false;
     
     if (productsValue && Array.isArray(productsValue) && productsValue.length > 1 && !reconciledValue) {
       recordsToSplit.push({ recordId: row.recordId, index });
     }
   });
   ```

   b. **Updating Parent Record** (for TXID):
   ```typescript
   if (txidFieldId && !record.data[txidFieldId]) {
     resourceService.instance!.commandManager.execute({
       cmd: CollaCommandName.SetRecords,
       data: [{
         recordId: recordId,
         fieldId: txidFieldId,
         value: recordId
       }]
     });
   }
   ```

   c. **Creating New Records**:
   ```typescript
   const result = resourceService.instance!.commandManager.execute({
     cmd: CollaCommandName.AddRecords,
     count: 1,
     viewId: view.id,
     index: index,
     cellValues: [cellValues]
   });
   ```

3. **Added the Button** (after Insert record button ~line 680):
```typescript
{!isOrgView && !isCalendarView && !isGalleryView && !isKanbanView && !isMobile && embedSetting.basicTools && iframeShowTool && (
  <ToolItem
    showLabel={showIconBarLabel}
    disabled={!permissions.rowCreatable}
    className={styles.toolbarItem}
    onClick={splitTransactions}
    icon={<RankOutlined size={16} color={colors.secondLevelText} className={styles.toolIcon} />}
    text={t(Strings.split_transactions)}
    id={DATASHEET_ID.TOOL_BAR_SPLIT_TRANSACTIONS}
  />
)}
```

## Step 6: Understanding Commands and Permissions

### Commands Used:
1. **CollaCommandName.SetRecords** - Update existing records
   - Used to set TXID on parent record
   
2. **CollaCommandName.AddRecords** - Create new records
   - Parameters: `count`, `viewId`, `index`, `cellValues`
   - Returns: `{ result: ExecuteResult, data: string[] }` (record IDs)

### Permission Checking:
- Used `permissions.rowCreatable` - same as Insert record button
- Button is disabled when user lacks permission

## Step 7: User Feedback Implementation

### Message Component Usage:
```typescript
import { Message } from 'pc/components/common';

// Success
Message.success({ 
  content: `Successfully split ${recordsToSplit.length} record${recordsToSplit.length > 1 ? 's' : ''} into ${successCount} new records!` 
});

// Warning
Message.warning({ content: 'Products field not found...' });

// Info
Message.info({ content: 'No records found that need splitting...' });

// Error
Message.error({ content: 'Failed to split records. Please try again.' });
```

## Step 8: Build Process

### Commands to Build:
```bash
# Build core package (for constants)
cd packages/core && pnpm run build

# Build i18n package (for strings)
cd packages/i18n-lang && pnpm run build

# Build datasheet (main app)
cd ../.. && pnpm run build:dst

# Run development server
pnpm run sd
```

## Common Patterns and Best Practices

1. **Field Type Constants**: Use `FieldType.OneWayLink`, `FieldType.Checkbox`, etc.
   - Import from `@apitable/core`

2. **Finding Fields by Name**: Iterate through `fieldMap`:
   ```typescript
   for (const [fieldId, field] of Object.entries(fieldMap)) {
     if (field.name === 'FieldName' && field.type === FieldType.Text) {
       // Found it
     }
   }
   ```

3. **Record Data Access**: 
   - Records are in `snapshot.recordMap[recordId]`
   - Field values are in `record.data[fieldId]`

4. **Button Visibility Logic**: Follow existing patterns
   - Check view type: `!isOrgView && !isCalendarView && ...`
   - Check device: `!isMobile`
   - Check settings: `embedSetting.basicTools && iframeShowTool`

5. **Error Handling**: Always validate and provide user feedback
   - Check if required fields exist
   - Validate data before processing
   - Show appropriate messages for each scenario

## Debugging Tips

1. **Console Logging**: Use for debugging during development
   ```typescript
   console.log('Field map:', fieldMap);
   console.log('Visible rows:', visibleRows);
   ```

2. **Type Checking**: TypeScript will help catch errors
   - Cast values when needed: `as string[]`, `as boolean`

3. **Testing Approach**:
   - Create test datasheet with required fields
   - Add sample data with various scenarios
   - Test edge cases (no records, missing fields, etc.)

## File Reference Summary

### Modified Files:
1. `packages/core/src/config/dom_id/datasheet_id.ts` - DOM constants
2. `packages/i18n-lang/src/config/strings.en-US.json` - English strings
3. `packages/i18n-lang/src/config/strings.zh-CN.json` - Chinese strings
4. `packages/datasheet/src/pc/components/tool_bar/tool_bar.tsx` - Main implementation

### Key Files to Reference:
1. `packages/core/src/types/field_types.ts` - Field type definitions
2. `packages/core/src/commands/enum.ts` - Command names
3. `packages/datasheet/src/pc/components/common/message/message.tsx` - Message component
4. `packages/datasheet/src/modules/shared/shortcut_key/shortcut_actions/append_row.ts` - Record creation patterns

This approach can be adapted for similar features that need to:
- Add UI elements to existing components
- Process records based on field values
- Create/update records programmatically
- Provide user feedback 