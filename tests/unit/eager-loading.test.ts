import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Model } from "../../src/core/database/Model";
import { Schema } from "../../src/core/database/Schema";
import { DatabaseConnection } from "../../src/core/database/Connection";
import { HasOne } from "../../src/core/database/relations/HasOne";
import { HasMany } from "../../src/core/database/relations/HasMany";
import { BelongsTo } from "../../src/core/database/relations/BelongsTo";

// Test models
class User extends Model {
  static override tableName = "users";

  profile(): HasOne<Profile> {
    return this.hasOne(Profile, "user_id", "id");
  }

  posts(): HasMany<Post> {
    return this.hasMany(Post, "user_id", "id");
  }
}

class Profile extends Model {
  static override tableName = "profiles";

  user(): BelongsTo<User> {
    return this.belongsTo(User, "user_id", "id");
  }
}

class Post extends Model {
  static override tableName = "posts";

  author(): BelongsTo<User> {
    return this.belongsTo(User, "user_id", "id");
  }
}

describe("Eager Loading", () => {
  let connection: DatabaseConnection;

  beforeAll(() => {
    // Create in-memory database connection
    connection = new DatabaseConnection({
      driver: "sqlite",
      connection: { filename: ":memory:" },
    });
    connection.connect();
    
    Model.setConnection(connection);
    Schema.setConnection(connection);

    // Create tables
    Schema.create("users", (table) => {
      table.id();
      table.string("name");
      table.string("email");
      table.timestamps();
    });

    Schema.create("profiles", (table) => {
      table.id();
      table.integer("user_id");
      table.string("bio");
      table.string("avatar");
      table.timestamps();
      table.foreign("user_id").references("id").on("users");
    });

    Schema.create("posts", (table) => {
      table.id();
      table.integer("user_id");
      table.string("title");
      table.text("content");
      table.timestamps();
      table.foreign("user_id").references("id").on("users");
    });
  });

  beforeEach(() => {
    // Clear all tables
    const db = connection.getDb();
    db.run("DELETE FROM posts");
    db.run("DELETE FROM profiles");
    db.run("DELETE FROM users");
  });

  afterAll(() => {
    connection.close();
  });

  describe("HasOne Eager Loading", () => {
    test("should eager load hasOne relationship", () => {
      // Create users with profiles
      const user1 = User.create({
        name: "John Doe",
        email: "john@example.com",
      });

      const user2 = User.create({
        name: "Jane Doe",
        email: "jane@example.com",
      });

      Profile.create({
        user_id: user1.get("id"),
        bio: "Developer",
        avatar: "john.jpg",
      });

      Profile.create({
        user_id: user2.get("id"),
        bio: "Designer",
        avatar: "jane.jpg",
      });

      // Eager load profiles
      const users = User.with("profile").get();

      expect(users.length).toBe(2);
      expect(users[0].profile).toBeDefined();
      expect(users[0].profile.bio).toBe("Developer");
      expect(users[1].profile).toBeDefined();
      expect(users[1].profile.bio).toBe("Designer");
    });

    test("should handle missing relationships gracefully", () => {
      // Create users, only one with profile
      const user1 = User.create({
        name: "John Doe",
        email: "john@example.com",
      });

      User.create({
        name: "Jane Doe",
        email: "jane@example.com",
      });

      Profile.create({
        user_id: user1.get("id"),
        bio: "Developer",
        avatar: "john.jpg",
      });

      // Eager load profiles
      const users = User.with("profile").get();

      expect(users.length).toBe(2);
      expect(users[0].profile).toBeDefined();
      expect(users[0].profile.bio).toBe("Developer");
      expect(users[1].profile).toBeNull();
    });
  });

  describe("HasMany Eager Loading", () => {
    test("should eager load hasMany relationship", () => {
      // Create users with posts
      const user1 = User.create({
        name: "John Doe",
        email: "john@example.com",
      });

      const user2 = User.create({
        name: "Jane Doe",
        email: "jane@example.com",
      });

      Post.create({
        user_id: user1.get("id"),
        title: "Post 1",
        content: "Content 1",
      });

      Post.create({
        user_id: user1.get("id"),
        title: "Post 2",
        content: "Content 2",
      });

      Post.create({
        user_id: user2.get("id"),
        title: "Post 3",
        content: "Content 3",
      });

      // Eager load posts
      const users = User.with("posts").get();

      expect(users.length).toBe(2);
      expect(users[0].posts).toBeDefined();
      expect(users[0].posts.length).toBe(2);
      expect(users[0].posts[0].title).toBe("Post 1");
      expect(users[0].posts[1].title).toBe("Post 2");
      expect(users[1].posts).toBeDefined();
      expect(users[1].posts.length).toBe(1);
      expect(users[1].posts[0].title).toBe("Post 3");
    });

    test("should handle empty hasMany relationships", () => {
      // Create users without posts
      User.create({
        name: "John Doe",
        email: "john@example.com",
      });

      User.create({
        name: "Jane Doe",
        email: "jane@example.com",
      });

      // Eager load posts
      const users = User.with("posts").get();

      expect(users.length).toBe(2);
      expect(users[0].posts).toBeDefined();
      expect(users[0].posts.length).toBe(0);
      expect(users[1].posts).toBeDefined();
      expect(users[1].posts.length).toBe(0);
    });
  });

  describe("BelongsTo Eager Loading", () => {
    test("should eager load belongsTo relationship", () => {
      // Create user with posts
      const user = User.create({
        name: "John Doe",
        email: "john@example.com",
      });

      Post.create({
        user_id: user.get("id"),
        title: "Post 1",
        content: "Content 1",
      });

      Post.create({
        user_id: user.get("id"),
        title: "Post 2",
        content: "Content 2",
      });

      // Eager load author
      const posts = Post.with("author").get();

      expect(posts.length).toBe(2);
      expect(posts[0].author).toBeDefined();
      expect(posts[0].author.name).toBe("John Doe");
      expect(posts[1].author).toBeDefined();
      expect(posts[1].author.name).toBe("John Doe");
    });
  });

  describe("Multiple Relationships", () => {
    test("should eager load multiple relationships", () => {
      // Create user with profile and posts
      const user = User.create({
        name: "John Doe",
        email: "john@example.com",
      });

      Profile.create({
        user_id: user.get("id"),
        bio: "Developer",
        avatar: "john.jpg",
      });

      Post.create({
        user_id: user.get("id"),
        title: "Post 1",
        content: "Content 1",
      });

      Post.create({
        user_id: user.get("id"),
        title: "Post 2",
        content: "Content 2",
      });

      // Eager load both relationships
      const users = User.with("profile", "posts").get();

      expect(users.length).toBe(1);
      expect(users[0].profile).toBeDefined();
      expect(users[0].profile.bio).toBe("Developer");
      expect(users[0].posts).toBeDefined();
      expect(users[0].posts.length).toBe(2);
    });
  });

  describe("Lazy Loading", () => {
    test("should lazy load relationship on demand", async () => {
      // Create user with posts
      const user = User.create({
        name: "John Doe",
        email: "john@example.com",
      });

      Post.create({
        user_id: user.get("id"),
        title: "Post 1",
        content: "Content 1",
      });

      // Load user without eager loading
      const loadedUser = User.find(user.get("id"))!;

      // Check that relationship is not loaded
      expect(loadedUser.relationLoaded("posts")).toBe(false);

      // Lazy load posts
      await loadedUser.load("posts");

      // Check that relationship is now loaded
      expect(loadedUser.relationLoaded("posts")).toBe(true);
      const posts = loadedUser.getRelation("posts");
      expect(posts.count()).toBe(1);
      expect(posts.first()?.get("title")).toBe("Post 1");
    });
  });
});
