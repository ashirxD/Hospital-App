// import { createSlice } from '@reduxjs/toolkit';

// const initialState = {
//   chatGroups: [], // Array of { _id, name, profilePicture, role, lastMessage, chatGroupId, isActive }
//   selectedUserId: null,
//   messages: [], // Messages for the selected chat
//   error: null,
//   loading: false,
// };

// const chatSlice = createSlice({
//   name: 'chat',
//   initialState,
//   reducers: {
//     fetchChatGroupsStart(state) {
//       state.loading = true;
//       state.error = null;
//     },
//     fetchChatGroupsSuccess(state, action) {
//       state.loading = false;
//       state.chatGroups = action.payload;
//     },
//     fetchChatGroupsFailure(state, action) {
//       state.loading = false;
//       state.error = action.payload;
//     },
//     fetchMessagesStart(state) {
//       state.loading = true;
//       state.error = null;
//     },
//     fetchMessagesSuccess(state, action) {
//       state.loading = false;
//       state.messages = action.payload;
//     },
//     fetchMessagesFailure(state, action) {
//       state.loading = false;
//       state.error = action.payload;
//     },
//     sendMessageStart(state) {
//       state.loading = true;
//       state.error = null;
//     },
//     sendMessageSuccess(state, action) {
//       state.loading = false;
//       const message = action.payload;
//       if (
//         String(message.recipientId) === String(state.selectedUserId) ||
//         String(message.senderId) === String(state.selectedUserId)
//       ) {
//         if (!state.messages.some((msg) => String(msg._id) === String(message._id))) {
//           state.messages.push(message);
//         }
//       }
//     },
//     sendMessageFailure(state, action) {
//       state.loading = false;
//       state.error = action.payload;
//     },
//     receiveMessage(state, action) {
//       const message = action.payload;
//       if (
//         String(message.recipientId) === String(state.selectedUserId) ||
//         String(message.senderId) === String(state.selectedUserId)
//       ) {
//         if (!state.messages.some((msg) => String(msg._id) === String(message._id))) {
//           state.messages.push(message);
//         }
//       }
//     },
//     updateChatGroup(state, action) {
//       const chatGroup = action.payload;
//       const otherParticipantId = chatGroup.participants.find(
//         (id) => String(id) !== String(action.payload.userId)
//       );
//       if (otherParticipantId) {
//         state.chatGroups = state.chatGroups.filter(
//           (group) => String(group._id) !== String(otherParticipantId)
//         );
//         state.chatGroups.push({
//           _id: otherParticipantId,
//           name: action.payload.name || 'Unknown',
//           profilePicture: action.payload.profilePicture || '/default-avatar.png',
//           role: action.payload.role || 'unknown',
//           lastMessage: chatGroup.lastMessage || null,
//           chatGroupId: chatGroup._id,
//           isActive: chatGroup.isActive,
//         });
//         state.chatGroups.sort((a, b) => {
//           const aTime = a.lastMessage?.createdAt ? new Date(a.lastMessage.createdAt) : new Date(0);
//           const bTime = b.lastMessage?.createdAt ? new Date(b.lastMessage.createdAt) : new Date(0);
//           if (aTime.getTime() === bTime.getTime()) {
//             return a.name.localeCompare(b.name);
//           }
//           return bTime - aTime;
//         });
//       }
//     },
//     resetChatGroup(state, action) {
//       const affectedUserId = action.payload.affectedUserId;
//       state.chatGroups = state.chatGroups.map((group) => {
//         if (String(group._id) === String(affectedUserId)) {
//           return { ...group, isActive: false };
//         }
//         return group;
//       });
//       if (String(state.selectedUserId) === String(affectedUserId)) {
//         state.selectedUserId = null;
//         state.messages = [];
//       }
//     },
//     selectUser(state, action) {
//       state.selectedUserId = action.payload;
//       state.messages = [];
//     },
//     clearError(state) {
//       state.error = null;
//     },
//   },
// });

// export const {
//   fetchChatGroupsStart,
//   fetchChatGroupsSuccess,
//   fetchChatGroupsFailure,
//   fetchMessagesStart,
//   fetchMessagesSuccess,
//   fetchMessagesFailure,
//   sendMessageStart,
//   sendMessageSuccess,
//   sendMessageFailure,
//   receiveMessage,
//   updateChatGroup,
//   resetChatGroup,
//   selectUser,
//   clearError,
// } = chatSlice.actions;

// export default chatSlice.reducer;