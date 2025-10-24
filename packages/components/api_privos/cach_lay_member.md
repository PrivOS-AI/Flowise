1. Lấy member của channel (public t:"c")

GENERAL là public:

curl -G "https://privos-chat-dev.roxane.one/api/v1/channels.members" \
 -H "X-User-Id: GRqeKLPGZ8zndK2by" \
 -H "X-Auth-Token: kXc4LJEysFof4UxvGJXY8rCvILCSFgQ-K35fNc38H-Z" \
 --data-urlencode "roomId=GENERAL" \
 --data-urlencode "count=200" \
| jq '.members[] | {id: .\_id, username, name, roles}'

(hoặc roomName=general)

2. Lấy member của private group ( t:"p" )

Ví dụ Market027 có \_id = 68ec612616afe32a121ca270:

curl -G "https://privos-chat-dev.roxane.one/api/v1/groups.members" \
 -H "X-User-Id: GRqeKLPGZ8zndK2by" \
 -H "X-Auth-Token: kXc4LJEysFof4UxvGJXY8rCvILCSFgQ-K35fNc38H-Z" \
 --data-urlencode "roomId=68ec612616afe32a121ca270" \
 --data-urlencode "count=200" \
| jq '.members[] | {id: .\_id, username, name, roles}'

Nếu gọi nhầm channels.members cho phòng t:"p" sẽ bị error-room-not-found.

3. Lấy member của DM ( t:"d" )

Với rid "47jWuGGAvKax98GtrGRqeKLPGZ8zndK2by":

curl -G "https://privos-chat-dev.roxane.one/api/v1/im.members" \
 -H "X-User-Id: GRqeKLPGZ8zndK2by" \
 -H "X-Auth-Token: kXc4LJEysFof4UxvGJXY8rCvILCSFgQ-K35fNc38H-Z" \
 --data-urlencode "roomId=47jWuGGAvKax98GtrGRqeKLPGZ8zndK2by" \
| jq '.members[] | {id: .\_id, username, name}'

4. Lấy member của Team

Trong dữ liệu của bạn, nhiều phòng có teamId: "68e31b56a009bfd5eaba8dc8". Để lấy toàn bộ thành viên của team:

curl -G "https://privos-chat-dev.roxane.one/api/v1/teams.members" \
 -H "X-User-Id: GRqeKLPGZ8zndK2by" \
 -H "X-Auth-Token: kXc4LJEysFof4UxvGJXY8rCvILCSFgQ-K35fNc38H-Z" \
 --data-urlencode "teamId=68e31b56a009bfd5eaba8dc8" \
 --data-urlencode "count=200" \
| jq '.members[] | {id: .user.\_id, username: .user.username, name: .user.name, roles}'

Còn nếu muốn liệt kê các phòng thuộc team trước:

curl -G "https://privos-chat-dev.roxane.one/api/v1/teams.listRooms" \
 -H "X-User-Id: GRqeKLPGZ8zndK2by" \
 -H "X-Auth-Token: kXc4LJEysFof4UxvGJXY8rCvILCSFgQ-K35fNc38H-Z" \
 --data-urlencode "teamId=68e31b56a009bfd5eaba8dc8" \
| jq '.rooms[] | {id: .\_id, name: .name, type: .t}'

5. Mẹo nhanh bằng jq (tự trích roomId theo tên)

Ví dụ lấy \_id các phòng t:"p" tên bắt đầu bằng “Market” rồi gọi groups.members:

# Lấy ids

ROOM_IDS=$(curl -sG "https://privos-chat-dev.roxane.one/api/v1/rooms.get" \
 -H "X-User-Id: GRqeKLPGZ8zndK2by" \
 -H "X-Auth-Token: kXc4LJEysFof4UxvGJXY8rCvILCSFgQ-K35fNc38H-Z" \
| jq -r '.update[] | select(.t=="p" and (.name|startswith("Market"))) | .\_id')

# Lặp lấy members cho từng phòng

for RID in $ROOM_IDS; do
  echo "== Members of $RID =="
  curl -sG "https://privos-chat-dev.roxane.one/api/v1/groups.members" \
    -H "X-User-Id: GRqeKLPGZ8zndK2by" \
    -H "X-Auth-Token: kXc4LJEysFof4UxvGJXY8rCvILCSFgQ-K35fNc38H-Z" \
    --data-urlencode "roomId=$RID" \
 | jq '.members[] | {id: .\_id, username, name}'
done

Tóm tắt

Dựa vào trường t:

c → channels.members

p → groups.members

d → im.members

Với team dùng teams.members (theo teamId).

Dùng count/offset để phân trang; pipe | jq ... để lọc nhanh.
