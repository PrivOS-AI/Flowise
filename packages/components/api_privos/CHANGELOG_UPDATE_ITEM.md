# Changelog - UPDATE ITEM in LIST Node

## Ngày: 16/10/2025

### 🎯 Các thay đổi chính:

#### 1. ✅ Sửa lỗi Assign User cho POST LIST và UPDATE LIST
**Vấn đề:** 
- Code chỉ sử dụng `channels.members` API endpoint cho tất cả loại room
- Không hoạt động với Private groups (`t: "p"`) và Direct messages (`t: "d"`)

**Giải pháp:**
- Thêm logic kiểm tra room type từ cache
- Tự động chọn đúng API endpoint:
  - `t: "c"` (Public channel) → `channels.members`
  - `t: "p"` (Private group) → `groups.members`
  - `t: "d"` (Direct message) → `im.members`

**Files đã sửa:**
- `/packages/components/nodes/agentflow/POST LIST/PrivosBatchCreate.ts`
- `/packages/components/nodes/agentflow/UPDATE ITEM in LIST/PrivosItemUpdate.ts`

#### 2. ✅ Sửa lỗi method name
**Vấn đề:**
- Node UPDATE ITEM dùng method `init` thay vì `run`
- Gây lỗi: `newNodeInstance.run is not a function`

**Giải pháp:**
- Đổi `async init()` thành `async run()` trong UPDATE ITEM node

#### 3. ✅ Sửa lỗi xử lý field_assignees
**Vấn đề:**
- Code gọi `.map()` trực tiếp trên `field_assignees` mà không kiểm tra type
- Gây lỗi: `field_assignees.map is not a function`

**Giải pháp:**
- Áp dụng cùng logic xử lý như POST LIST
- Hỗ trợ nhiều format input:
  - String JSON: `'{"_id":"123","username":"user1"}'`
  - Array JSON string: `'[{"_id":"123","username":"user1"}]'`
  - Array of strings: `['{"_id":"123"}', '{"_id":"456"}']`
  - Direct object/array

#### 4. ✅ Cải thiện Output Format
**Cải tiến:**
- Format output đẹp mắt với ASCII art và separators
- Hiển thị thông tin chi tiết:
  - Item ID và Name
  - List name
  - Updated fields với format thông minh:
    - Users: `@username1, @username2`
    - Dates: `16/10/2025, 17:30:00`
    - Objects: JSON pretty print
- Error handling rõ ràng với details

**Output structure:**
```javascript
{
  id: nodeId,
  name: nodeName,
  input: payload,
  output: {
    content: "formatted text",  // ✨ Formatted for display
    success: true,
    itemId: "...",
    itemName: "...",
    listId: "...",
    listName: "...",
    updatedFieldsCount: 3,
    updatedItem: {...}
  },
  state: {...}
}
```

#### 5. ✅ Thêm Stage Filter cho SELECT ITEM
**Tính năng mới:**
- Thêm dropdown "Select Stage (Optional)" giữa List và Item
- Filter items theo stage khi có stage được chọn
- Hiển thị tất cả items nếu không chọn stage

**Workflow mới:**
```
Select Room → Select List → Select Stage (Optional) → Select Item
```

**API sử dụng:**
- Có stage: `GET /v1/external.items.byStageId?stageId=xxx&limit=100`
- Không stage: `GET /v1/external.items.byListId?listId=xxx&offset=0&count=100`

**Method mới:**
- `listStages()`: Load danh sách stages từ list
- `listItems()`: Updated để support filter by stage

### 📋 Testing Checklist:

- [x] Assign user cho Public channel (`t: "c"`)
- [x] Assign user cho Private group (`t: "p"`)
- [ ] Assign user cho Direct message (`t: "d"`)
- [x] Update item với multiple assignees
- [x] Update item với dates
- [x] Update item với documents
- [x] Filter items by stage
- [x] Show all items (no stage filter)
- [x] Output format hiển thị đẹp

### 🚀 Cách sử dụng:

1. **Rebuild components:**
   ```bash
   cd /Users/roxane/Flowise/packages/components
   pnpm run build
   ```

2. **Restart Flowise dev server**

3. **Test workflow:**
   - Chọn Room (bất kỳ loại: public/private/dm)
   - Chọn List
   - (Optional) Chọn Stage để filter
   - Chọn Item cần update
   - Thay đổi các fields cần thiết
   - Chạy flow và xem output format mới

### 📝 Notes:

- **Room type detection:** Sử dụng cache để tránh gọi API nhiều lần
- **Backward compatible:** Code vẫn hoạt động với format cũ
- **Error handling:** Tất cả errors đều được catch và format đẹp
- **Performance:** Sử dụng cache với TTL 5 phút cho rooms và field definitions

### 🐛 Known Issues:

- Chưa test với team rooms (cần thêm `teams.members` endpoint nếu cần)
- File upload trong UPDATE ITEM vẫn là TODO

### 🎨 Output Example:

```
ITEM UPDATED SUCCESSFULLY
==================================================

ITEM ID: 68ec612616afe32a121ca999
ITEM NAME: Marketing Campaign Q4

LIST: Marketing Tasks

==================================================
UPDATED FIELDS:
==================================================

   Assignees: @user1, @user2, @user3
   Due Date: 31/12/2025, 23:59:59
   Start Date: 01/10/2025, 00:00:00
   Note: Updated notes for Q4 campaign

==================================================

The item has been updated successfully.
```
