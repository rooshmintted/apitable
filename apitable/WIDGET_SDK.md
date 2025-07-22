# APITable Widget SDK Guide

> Build, run and ship custom widgets for APITable.

---

## 1  Overview
The `@apitable/widget-sdk` package provides **React-friendly**, fully-typed utilities that let you read & write datasheet data, render rich UI pickers and integrate with the live collaboration engine – all from an isolated IFrame or a standalone page.

The SDK bundles:
* A **Redux** store that mirrors the APITable state you are allowed to see.
* **Model classes** (`Datasheet`, `Record`, `Field`, `CloudStorage`) with high-level CRUD helpers.
* A rich set of **React hooks** – `useRecords`, `useField`, `useViewport`, … – for reactive data binding.
* Re-usable **UI components** such as `ViewPicker`, `FieldPicker`, `CellValue`, `Filter`.
* **Message & subscribe** layer that keeps your widget in sync with the room-server.
* Helper utilities (upload, i18n, signature manager, etc.).

If you have used the Airtable blocks SDK you will feel at home – but with more features around permissions, real-time OT and enterprise security.

---

## 2  Installation
```bash
pnpm add @apitable/widget-sdk
# or
npm i @apitable/widget-sdk
```
The SDK has **no peer dependencies** besides React (>=17) and will polyfill `ResizeObserver` automatically.

---

## 3  Bootstrapping a Widget
```tsx
import React from 'react';
import { initializeWidget } from '@apitable/widget-sdk';

const HelloWidget: React.FC = () => {
  return <div style={{ padding: 24 }}>👋 Hello from my widget!</div>;
};

// APITable will inject `__WIDGET_PACKAGE_ID__` at build time (widget-cli does this)
initializeWidget(HelloWidget, process.env.__WIDGET_PACKAGE_ID__);
```
During **development** the CLI serves the bundle on `http://localhost:5173/index.js` and hot-reloads both code & sandbox permissions.

Production widgets are distributed as static JS bundles that APITable downloads on demand via `loadWidget(url, packageId)`.

---

## 4  Core APIs
### 4.1 initializeWidget
```ts
initializeWidget(Component: React.FC, widgetPackageId: string): void
```
Registers a React component under the provided package-id so it can be mounted by the APITable host.

### 4.2 Models
The SDK exposes 4 high-level model classes. All methods **return promises** when they touch the network.

#### Datasheet
Property / Method | Type | Notes
--- | --- | ---
`id` | `string` | Datasheet id (e.g. `dstxxxxxxxx`)
`name` | `string` | Display name
`addRecord(valuesMap, position?)` | `Promise<string>` | Creates a single record
`addRecords(records, position?)` | `Promise<string[]>` | Bulk create
`setRecord(recordId, valuesMap)` | `Promise<void>` | Update one
`setRecords(records)` | `Promise<void>` | Bulk update
`deleteRecord(recordId)` | `Promise<void>` | Remove record
`deleteRecords(ids)` | `Promise<void>` |
`addField(name, type, property?)` | `Promise<string>` | Create column
`deleteField(fieldId, conversion?)` | `Promise<void>` |
`checkPermissionsFor*` | `IPermissionResult` | Nine different helpers that validate current user permissions before a call – see **permissions** below.

#### Record
Property / Method | Type | Notes
--- | --- | ---
`id` | `string` |
`title` | `string \| null` | Primary field value (stringified)
`commentCount` | `number` |
`getCellValue(fieldId)` | `any` | Parsed value (see Field types)
`getCellValueString(fieldId)` | `string \| null` | Value coerced to string
`url(viewId?)` | `string` | Deep link that opens the record in APITable UI

#### Field
Property / Method | Type | Notes
--- | --- | ---
`id` | `string` |
`name` | `string` |
`type` | `FieldType` |
`property` | `any` | Type-specific meta (options, precision, …)
`validateCellValue(value)` | `{ error?: Error }` |
`cellValueToOpenValue(value)` | `any` | Converts internal value → open format
`openWriteValueToCellValue(value)` | `any` | Converts open format → internal value

#### CloudStorage
Key/value storage scoped to **workspace** or **widget**.
Method | Notes
--- | ---
`getAsync(keys)` – string or string[]
`setAsync(pairs)` – record<string, any>
`removeAsync(keys)` – string or string[]

### 4.3 Permissions helpers
`DatasheetOperationPermission` enum provides bit-masks for `AddRecord`, `EditRecord`, `DeleteRecord`, `AddField`, `DeleteField`.
Every mutation method has a `checkPermissionsFor*` counterpart returning:
```ts
interface IPermissionResult { acceptable: boolean; message?: string }
```

---

## 5  React Hooks
Import directly from the SDK – they are **fully typed**:
Hook | Purpose
--- | ---
`useDatasheet(datasheetId?)` | Returns a `Datasheet` instance
`useRecords(datasheetId, opts?)` | Reactive list of `Record` ✱ follows current view & filters
`useRecord(recordId, datasheetId?)` | Single record
`useRecordsAll(datasheetId)` | All records (ignores view filters)
`useFields(datasheetId)` | All `Field` objects
`useField(fieldId, datasheetId?)` | Field by id
`usePrimaryField(datasheetId)` | First column of first view
`useActiveViewId(datasheetId?)` | Current view id
`useViewIds(datasheetId)` | All view ids
`useViewMeta(viewId, datasheetId?)` | View meta
`useViewsMeta(datasheetId)` | Meta of all views
`useViewport()` | Widget sandbox dimensions & scroll position
`useSelection(datasheetId?)` | Current user cell/record selection
`useActiveCell(datasheetId?)` | `{ recordId, fieldId }` of focused cell
`useExpandRecord()` | Imperative helper to open the native record detail dialog
`useSettingsButton()` | Control the gear icon visibility & click handler
`useCollaborators()` | Workspace users present in the sheet
`useCloudStorage(scope?)` | Key/value storage wrapper described above
`useSession()` | Current user session information
`useUnitInfo()` | Unit / organization info

> **Tip:** All hooks automatically unsubscribe when the component unmounts – no need for manual cleanup.

---

## 6  UI Components
Component | Description
--- | ---
`<ViewPicker>` | Dropdown to choose a view (grid, kanban, …)
`<FieldPicker>` | Dropdown to choose a field. Accepts `allowedTypes` & `disabledTypes` props.
`<CellValue value field />` | Renders a cell just like the native UI (read-only).
`<Filter>` | Helpers to build filter conditions matching APITable query language.

All components are theme-aware and rely on Ant Design.

---

## 7  Enums & Types
### 7.1 FieldType
```ts
enum FieldType {
  NotSupport,
  Text,
  Number,
  SingleSelect,
  MultiSelect,
  DateTime,
  Attachment,
  OneWayLink,
  TwoWayLink,
  URL,
  Email,
  Phone,
  Checkbox,
  Rating,
  Member,
  MagicLookUp,
  Formula,
  Currency,
  Percent,
  SingleText,
  AutoNumber,
  CreatedTime,
  LastModifiedTime,
  CreatedBy,
  LastModifiedBy,
  Cascader,
  WorkDoc,
  Button,
}
```
Each field type section inside the SDK source (`src/interface/field_types.ts`) explains **read / write formats**, property schema and examples.

### 7.2 Other notable enums
* `ViewType` – Grid, Kanban, Calendar, …  (`src/interface/view_types.ts`)
* `DatasheetOperationPermission`
* `WidgetLoadError`

---

## 8  Utilities
Function | Location | Purpose
--- | --- | ---
`upload(file, opts?)` | `utils/upload` | Smart uploader that picks S3/minio & attaches metadata
`t(key, params?)` | `utils/i18n` | Tiny wrapper around `@apitable/i18n-lang`
`errMsg(message)` | `utils/private` | Generates **IPermissionResult** with `acceptable=false`
`assertSignatureManager` | `helper/assert_signature_manager` | Batch generate secure attachment signatures
`Script.*` | `script` namespace | Helpers dedicated to **Formula scripting runtime**

---

## 9  Message & Subscribe Layer (advanced)
Internally the SDK opens a websocket connection (Colla Engine) per datasheet and keeps a client-side Redux store in sync. You usually don’t have to touch this but it is available:
* `subscribeDatasheetMap(store, { instance })`
* `subscribeWidgetMap(store, { instance })`
* `cmdExecute(name, params)` – low-level command executor

---

## 10  Error Handling
The SDK ships a ready-to-use `<ErrorBoundary>` and a helper `showPermissionError` exported from `error_message.ts`.

---

## 11  Developing & Debugging Widgets
1. `pnpm add -g @apitable/widget-cli`
2. `widget-cli init my-widget` – scaffolds a Vite + TypeScript project
3. `pnpm dev` – serves the bundle and prints the `bundleUrl`
4. Paste the dev URL into the *Add Widget* dialog inside APITable → your widget will hot-reload.

Widget CLI ≥ **v1.4.0** is required (checked at runtime via `checkCliVersion`).

---

## 12  Auto-generated API Reference
Running `pnpm --filter widget-sdk run docs` executes `packages/widget-sdk/docs.js` which uses **TypeDoc + typedoc-plugin-markdown** to generate fully-typed markdown docs under `dev-book/docs/widget/api-reference/`.

For exhaustive method signatures refer to those docs – this guide focuses on the big picture.

---

## 13  License
The Widget SDK is released under the **GNU AGPL v3** – see [LICENSE](LICENSE-EMBEDDING) for details.

---

Happy hacking & let us know what you build! 🎉 