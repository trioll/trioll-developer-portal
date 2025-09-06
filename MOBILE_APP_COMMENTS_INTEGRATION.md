# Mobile App Comments Integration Guide

## Overview
This guide shows how to integrate the comments API into the Trioll Mobile app's existing comment popup.

## API Endpoints

### Base URL
```
https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod
```

### Endpoints
- **GET** `/games/{gameId}/comments` - Get all comments for a game
- **POST** `/games/{gameId}/comments` - Post a new comment

## Integration Steps

### 1. Update Comment Service

Create or update your comment service file:

```typescript
// src/services/commentService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE = 'https://4ib0hvu1xj.execute-api.us-east-1.amazonaws.com/prod';

export interface Comment {
  commentId: string;
  gameId: string;
  userId: string;
  username?: string;
  commentText: string;
  timestamp: string;
  likes: number;
  edited?: boolean;
}

export interface CommentsResponse {
  gameId: string;
  comments: Comment[];
  count: number;
}

class CommentService {
  // Get auth token (guest or authenticated)
  async getAuthToken(): Promise<string> {
    // Try to get authenticated token first
    const userToken = await AsyncStorage.getItem('userToken');
    if (userToken) {
      return userToken;
    }
    
    // Fall back to guest token
    const guestId = await AsyncStorage.getItem('guestId') || `guest-${Date.now()}`;
    await AsyncStorage.setItem('guestId', guestId);
    return `guest-${guestId}`;
  }

  // Get comments for a game
  async getComments(gameId: string): Promise<CommentsResponse> {
    try {
      const response = await fetch(`${API_BASE}/games/${gameId}/comments`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comments');
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching comments:', error);
      return {
        gameId,
        comments: [],
        count: 0,
      };
    }
  }

  // Post a new comment
  async postComment(gameId: string, commentText: string, username?: string): Promise<Comment | null> {
    try {
      const token = await this.getAuthToken();
      
      const payload = {
        gameId,
        comment: commentText, // Note: API expects 'comment' not 'text'
        username: username || 'Player',
      };

      const response = await fetch(`${API_BASE}/games/${gameId}/comments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to post comment');
      }

      const data = await response.json();
      
      // Transform response to match Comment interface
      return {
        commentId: data.commentId,
        gameId: data.gameId,
        userId: data.userId,
        username: username || 'Player',
        commentText: data.commentText,
        timestamp: data.timestamp,
        likes: data.likes || 0,
        edited: false,
      };
    } catch (error) {
      console.error('Error posting comment:', error);
      return null;
    }
  }
}

export default new CommentService();
```

### 2. Update Comment Popup Component

Update your existing comment popup to use the real API:

```typescript
// src/components/CommentPopup.tsx (or similar)
import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import commentService, { Comment } from '../services/commentService';

interface CommentPopupProps {
  visible: boolean;
  gameId: string;
  gameName: string;
  onClose: () => void;
}

const CommentPopup: React.FC<CommentPopupProps> = ({
  visible,
  gameId,
  gameName,
  onClose,
}) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [posting, setPosting] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [username, setUsername] = useState('');

  // Load comments when popup opens
  useEffect(() => {
    if (visible && gameId) {
      loadComments();
    }
  }, [visible, gameId]);

  const loadComments = async () => {
    setLoading(true);
    try {
      const response = await commentService.getComments(gameId);
      setComments(response.comments);
    } catch (error) {
      console.error('Error loading comments:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim()) return;

    setPosting(true);
    try {
      const postedComment = await commentService.postComment(
        gameId,
        newComment.trim(),
        username.trim() || undefined
      );

      if (postedComment) {
        // Add new comment to the top of the list
        setComments([postedComment, ...comments]);
        setNewComment('');
        // Keep username for next comment
      }
    } catch (error) {
      console.error('Error posting comment:', error);
    } finally {
      setPosting(false);
    }
  };

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentItem}>
      <View style={styles.commentHeader}>
        <Text style={styles.commentUsername}>
          {item.username || item.userId || 'Anonymous'}
        </Text>
        <Text style={styles.commentTime}>
          {new Date(item.timestamp).toLocaleDateString()}
        </Text>
      </View>
      <Text style={styles.commentText}>{item.commentText}</Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.popup}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Comments</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <Text style={styles.gameName}>{gameName}</Text>

          {/* Comments List */}
          {loading ? (
            <ActivityIndicator size="large" color="#4CAF50" style={styles.loader} />
          ) : (
            <FlatList
              data={comments}
              renderItem={renderComment}
              keyExtractor={(item) => item.commentId}
              contentContainerStyle={styles.commentsList}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
              }
            />
          )}

          {/* Comment Input */}
          <View style={styles.inputSection}>
            <TextInput
              style={styles.nameInput}
              placeholder="Your name (optional)"
              value={username}
              onChangeText={setUsername}
              placeholderTextColor="#999"
            />
            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                value={newComment}
                onChangeText={setNewComment}
                multiline
                placeholderTextColor="#999"
              />
              <TouchableOpacity
                style={[styles.postButton, posting && styles.postButtonDisabled]}
                onPress={handlePostComment}
                disabled={posting || !newComment.trim()}
              >
                <Text style={styles.postButtonText}>
                  {posting ? 'Posting...' : 'Post'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = {
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  popup: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  closeButton: {
    padding: 8,
  },
  closeText: {
    fontSize: 24,
    color: '#666',
  },
  gameName: {
    fontSize: 16,
    color: '#666',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  loader: {
    paddingVertical: 40,
  },
  commentsList: {
    paddingHorizontal: 16,
  },
  emptyText: {
    textAlign: 'center',
    color: '#999',
    fontSize: 16,
    paddingVertical: 40,
  },
  commentItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  commentUsername: {
    fontWeight: '600',
    color: '#333',
    fontSize: 14,
  },
  commentTime: {
    color: '#999',
    fontSize: 12,
  },
  commentText: {
    color: '#666',
    fontSize: 15,
    lineHeight: 20,
  },
  inputSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    padding: 16,
  },
  nameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
    fontSize: 15,
    color: '#333',
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  commentInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 10,
    fontSize: 15,
    maxHeight: 100,
    color: '#333',
  },
  postButton: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginLeft: 10,
  },
  postButtonDisabled: {
    backgroundColor: '#ccc',
  },
  postButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
};

export default CommentPopup;
```

### 3. Usage in Game Screen

In your game screen where the comment button is located:

```typescript
// In your game component
const [commentPopupVisible, setCommentPopupVisible] = useState(false);

// In your render:
<TouchableOpacity onPress={() => setCommentPopupVisible(true)}>
  <Icon name="comment" size={24} color="#666" />
</TouchableOpacity>

<CommentPopup
  visible={commentPopupVisible}
  gameId={game.id || game.gameId}
  gameName={game.name || game.title}
  onClose={() => setCommentPopupVisible(false)}
/>
```

## Testing

1. **Test with existing games**:
   - Horror Pong: `horror-pong-1757075261334`
   - Cannon Shot: `cannon-shot-1757105583409`

2. **Verify**:
   - Comments load when popup opens
   - New comments can be posted
   - Comments appear immediately after posting
   - Guest users can comment
   - Authenticated users can comment

## Important Notes

1. **Authentication**: The API requires authentication. The service handles both:
   - Authenticated users: Uses their token
   - Guest users: Creates a guest token

2. **Field Names**: The API expects `comment` not `text` or `commentText` for posting

3. **Error Handling**: The service includes error handling, but you may want to show user-friendly error messages

4. **Real-time Updates**: Currently, comments don't update in real-time. You could add:
   - Pull-to-refresh
   - Auto-refresh every 30 seconds
   - WebSocket support (future enhancement)

## Next Steps

1. Implement the comment service
2. Update your existing popup component
3. Test with real games
4. Consider adding:
   - Comment editing (for user's own comments)
   - Comment deletion
   - Like comments feature
   - Report inappropriate comments