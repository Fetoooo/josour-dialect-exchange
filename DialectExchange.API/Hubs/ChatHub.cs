using DialectExchange.Core.Entities;
using DialectExchange.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using System.Security.Claims;

namespace DialectExchange.API.Hubs
{
    [Authorize]
    public class ChatHub : Hub
    {
        private readonly AppDbContext _context;

        // userId → connectionId (in-memory, fine for single-server)
        private static readonly Dictionary<string, string> _connections = new();

        public ChatHub(AppDbContext context) { _context = context; }

        // ── Lifecycle ─────────────────────────────────────────
        public override async Task OnConnectedAsync()
        {
            var userId = GetUserId();
            if (userId != null)
            {
                _connections[userId] = Context.ConnectionId;
                await Clients.All.SendAsync("UserOnline", userId);
            }
            await base.OnConnectedAsync();
        }

        public override async Task OnDisconnectedAsync(Exception? exception)
        {
            var userId = GetUserId();
            if (userId != null)
            {
                _connections.Remove(userId);
                await Clients.All.SendAsync("UserOffline", userId);
            }
            await base.OnDisconnectedAsync(exception);
        }

        // ── ★ NEW: Push a notification to a specific user ──────
        // Called by controllers (ExchangesController) via IHubContext
        public static async Task NotifyUser(
            IHubContext<ChatHub> hubContext,
            string targetUserId,
            string type,          // "like" | "comment" | "message" | "system"
            string title,
            string body,
            string icon,
            string? fromUser = null,
            string? targetId = null)
        {
            if (!_connections.TryGetValue(targetUserId, out var connectionId)) return;

            await hubContext.Clients.Client(connectionId).SendAsync("ReceiveNotification", new
            {
                type,
                title,
                body,
                icon,
                fromUser,
                targetId,
                createdAt = DateTime.UtcNow
            });
        }

        // ── Text message ──────────────────────────────────────
        public async Task SendMessage(string receiverId, string content)
        {
            var senderId = GetUserId();
            if (senderId == null || string.IsNullOrWhiteSpace(content)) return;

            var sender = await _context.Users.FindAsync(senderId);
            if (sender == null) return;

            var message = new Message
            {
                MessageType = "text",
                SenderId = senderId,
                ReceiverId = receiverId,
                Content = content,
                SentAt = DateTime.UtcNow
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            var payload = BuildPayload(message, sender.DisplayNameAr);

            if (_connections.TryGetValue(receiverId, out var receiverConn))
                await Clients.Client(receiverConn).SendAsync("ReceiveMessage", payload);
            await Clients.Caller.SendAsync("ReceiveMessage", payload);
        }

        // ── File/Image/Voice message ──────────────────────────
        public async Task SendFileMessage(string receiverId, string fileUrl, string fileName, long fileSize, string messageType)
        {
            var senderId = GetUserId();
            if (senderId == null) return;

            var sender = await _context.Users.FindAsync(senderId);
            if (sender == null) return;

            var message = new Message
            {
                MessageType = messageType,
                SenderId = senderId,
                ReceiverId = receiverId,
                Content = fileName,
                FileUrl = fileUrl,
                FileName = fileName,
                FileSize = fileSize,
                SentAt = DateTime.UtcNow
            };

            _context.Messages.Add(message);
            await _context.SaveChangesAsync();

            var payload = BuildPayload(message, sender.DisplayNameAr);

            if (_connections.TryGetValue(receiverId, out var receiverConn))
                await Clients.Client(receiverConn).SendAsync("ReceiveMessage", payload);
            await Clients.Caller.SendAsync("ReceiveMessage", payload);
        }

        // ── Edit message ──────────────────────────────────────
        public async Task EditMessage(Guid messageId, string newContent)
        {
            var userId = GetUserId();
            var message = await _context.Messages.FindAsync(messageId);

            if (message == null || message.SenderId != userId) return;
            if ((DateTime.UtcNow - message.SentAt).TotalMinutes > 5) return;
            if (message.IsDeleted) return;

            message.Content = newContent;
            message.IsEdited = true;
            message.EditedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync();

            var editPayload = new { messageId = message.Id, newContent, editedAt = message.EditedAt };

            if (_connections.TryGetValue(message.ReceiverId, out var receiverConn))
                await Clients.Client(receiverConn).SendAsync("MessageEdited", editPayload);
            await Clients.Caller.SendAsync("MessageEdited", editPayload);
        }

        // ── Delete message ────────────────────────────────────
        public async Task DeleteMessage(Guid messageId)
        {
            var userId = GetUserId();
            var message = await _context.Messages.FindAsync(messageId);

            if (message == null || message.SenderId != userId) return;
            if ((DateTime.UtcNow - message.SentAt).TotalMinutes > 5) return;

            message.IsDeleted = true;
            message.DeletedAt = DateTime.UtcNow;
            message.Content = "تم حذف هذه الرسالة";
            await _context.SaveChangesAsync();

            var deletePayload = new { messageId = message.Id };

            if (_connections.TryGetValue(message.ReceiverId, out var receiverConn))
                await Clients.Client(receiverConn).SendAsync("MessageDeleted", deletePayload);
            await Clients.Caller.SendAsync("MessageDeleted", deletePayload);
        }

        public async Task GetOnlineUsers()
        {
            await Clients.Caller.SendAsync("OnlineUsers", _connections.Keys.ToList());
        }

        // ── WebRTC Signaling ──────────────────────────────────
        public async Task CallUser(string targetUserId, string callerName, string callType = "video")
        {
            var callerId = GetUserId();
            if (callerId == null) return;
            if (_connections.TryGetValue(targetUserId, out var targetConnection))
                await Clients.Client(targetConnection).SendAsync("IncomingCall", new { callerId, callerName, callType });
            else
                await Clients.Caller.SendAsync("CallFailed", "المستخدم غير متصل حالياً");
        }

        public async Task AcceptCall(string callerId)
        {
            if (_connections.TryGetValue(callerId, out var callerConnection))
                await Clients.Client(callerConnection).SendAsync("CallAccepted", GetUserId());
        }

        public async Task RejectCall(string callerId)
        {
            if (_connections.TryGetValue(callerId, out var callerConnection))
                await Clients.Client(callerConnection).SendAsync("CallRejected");
        }

        public async Task EndCall(string otherUserId)
        {
            if (_connections.TryGetValue(otherUserId, out var otherConnection))
                await Clients.Client(otherConnection).SendAsync("CallEnded");
        }

        public async Task SendOffer(string targetUserId, string sdp)
        {
            if (_connections.TryGetValue(targetUserId, out var conn))
                await Clients.Client(conn).SendAsync("ReceiveOffer", sdp);
        }

        public async Task SendAnswer(string targetUserId, string sdp)
        {
            if (_connections.TryGetValue(targetUserId, out var conn))
                await Clients.Client(conn).SendAsync("ReceiveAnswer", sdp);
        }

        public async Task SendIceCandidate(string targetUserId, string candidate)
        {
            if (_connections.TryGetValue(targetUserId, out var conn))
                await Clients.Client(conn).SendAsync("ReceiveIceCandidate", candidate);
        }

        // ── Helpers ───────────────────────────────────────────
        private static object BuildPayload(Message m, string senderName) => new
        {
            id = m.Id, messageType = m.MessageType,
            senderId = m.SenderId, senderName,
            receiverId = m.ReceiverId, content = m.Content,
            fileUrl = m.FileUrl, fileName = m.FileName, fileSize = m.FileSize,
            sentAt = m.SentAt, isRead = m.IsRead,
            isDeleted = m.IsDeleted, isEdited = m.IsEdited
        };

        private string? GetUserId() =>
            Context.User?.FindFirstValue(ClaimTypes.NameIdentifier) ??
            Context.User?.FindFirstValue("id") ??
            Context.User?.FindFirstValue("sub");
    }
}