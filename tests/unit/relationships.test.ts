import { describe, test, expect, beforeAll, afterAll, beforeEach } from "bun:test";
import { Model } from "../../src/core/database/Model";
import { Schema } from "../../src/core/database/Schema";
import { DatabaseConnection } from "../../src/core/database/Connection";
import { HasOne } from "../../src/core/database/relations/HasOne";
import { HasMany } from "../../src/core/database/relations/HasMany";
import { BelongsTo } from "../../src/core/database/relations/BelongsTo";
import { BelongsToMany } from "../../src/core/database/relations/BelongsToMany";

// Test models
class User extends Model {
  static override tableName = "users";

  // Relationships
  profile(): HasOne<Profile> {
    return this.hasOne(Profile, "user_id", "id");
  }

  posts(): HasMany<Post> {
    return this.hasMany(Post, "user_id", "id");
  }

  roles(): BelongsToMany<Role> {
    return this.belongsToMany(Role, "role_user", "user_id", "role_id");
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

class Role extends Model {
  static override tableName = "roles";

  users(): BelongsToMany<User> {
    return this.belongsToMany(User, "role_user", "role_id", "user_id");
  }
}

describe("Eloquent Relationships", () => {
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

    Schema.create("roles", (table) => {
      table.id();
      table.string("name");
      table.timestamps();
    });

    Schema.create("role_user", (table) => {
      table.id();
      table.integer("user_id");
      table.integer("role_id");
      table.timestamps();
      table.foreign("user_id").references("id").on("users");
      table.foreign("role_id").references("id").on("roles");
    });
  });

  beforeEach(() => {
    // Clear all tables
    const db = connection.getDb();
    db.run("DELETE FROM role_user");
    db.run("DELETE FROM posts");
    db.run("DELETE FROM profiles");
    db.run("DELETE FROM roles");
    db.run("DELETE FROM users");
  });

  afterAll(() => {
    connection.close();
  });

  describe("HasOne Relationship", () => {
    test("should return relationship instance", () => {
      const user = new User();
      user.set("id", 1);
      const relation = user.profile();
      
      expect(relation).toBeInstanceOf(HasOne);
    });

    test("should load related model", async () => {
      // Create user
      const user = new User();
      user.set("name", "John Doe");
      user.set("email", "john@example.com");
      await user.save();

      // Create profile
      const profile = new Profile();
      profile.set("user_id", user.get("id"));
      profile.set("bio", "Software developer");
      profile.set("avatar", "avatar.jpg");
      await profile.save();

      // Load relationship
      const loadedProfile = await user.profile().get();
      
      expect(loadedProfile).not.toBeNull();
      expect(loadedProfile?.get("bio")).toBe("Software developer");
      expect(loadedProfile?.get("avatar")).toBe("avatar.jpg");
      expect(loadedProfile?.get("user_id")).toBe(user.get("id"));
    });

    test("should return null when no related model exists", async () => {
      const user = new User();
      user.set("name", "Jane Doe");
      user.set("email", "jane@example.com");
      await user.save();

      const profile = await user.profile().get();
      
      expect(profile).toBeNull();
    });

    test("should create related model", async () => {
      const user = new User();
      user.set("name", "Bob Smith");
      user.set("email", "bob@example.com");
      await user.save();

      const profile = await user.profile().create({
        bio: "Designer",
        avatar: "bob.jpg",
      });

      expect(profile.get("user_id")).toBe(user.get("id"));
      expect(profile.get("bio")).toBe("Designer");
      
      // Verify in database
      const saved = await user.profile().get();
      expect(saved).not.toBeNull();
      expect(saved?.get("bio")).toBe("Designer");
    });

    test("should save related model", async () => {
      const user = new User();
      user.set("name", "Alice");
      user.set("email", "alice@example.com");
      await user.save();

      const profile = new Profile();
      profile.set("bio", "Writer");
      profile.set("avatar", "alice.jpg");

      await user.profile().save(profile);

      expect(profile.get("user_id")).toBe(user.get("id"));
      
      // Verify in database
      const saved = await user.profile().get();
      expect(saved).not.toBeNull();
      expect(saved?.get("bio")).toBe("Writer");
    });
  });

  describe("HasMany Relationship", () => {
    test("should return relationship instance", () => {
      const user = new User();
      user.set("id", 1);
      const relation = user.posts();
      
      expect(relation).toBeInstanceOf(HasMany);
    });

    test("should load related models", async () => {
      // Create user
      const user = new User();
      user.set("name", "John Doe");
      user.set("email", "john@example.com");
      await user.save();

      // Create posts
      const post1 = new Post();
      post1.set("user_id", user.get("id"));
      post1.set("title", "First Post");
      post1.set("content", "Content 1");
      await post1.save();

      const post2 = new Post();
      post2.set("user_id", user.get("id"));
      post2.set("title", "Second Post");
      post2.set("content", "Content 2");
      await post2.save();

      // Load relationship
      const posts = await user.posts().get();
      
      expect(posts.count()).toBe(2);
      const titles = posts.map((p: Post) => p.get("title")).toArray();
      expect(titles).toEqual(["First Post", "Second Post"]);
    });

    test("should return empty collection when no related models exist", async () => {
      const user = new User();
      user.set("name", "Jane Doe");
      user.set("email", "jane@example.com");
      await user.save();

      const posts = await user.posts().get();
      
      expect(posts.count()).toBe(0);
      expect(posts.isEmpty()).toBe(true);
    });

    test("should create related model", async () => {
      const user = new User();
      user.set("name", "Bob Smith");
      user.set("email", "bob@example.com");
      await user.save();

      const post = await user.posts().create({
        title: "New Post",
        content: "New content",
      });

      expect(post.get("user_id")).toBe(user.get("id"));
      expect(post.get("title")).toBe("New Post");
      
      // Verify in database
      const posts = await user.posts().get();
      expect(posts.count()).toBe(1);
    });

    test("should save related model", async () => {
      const user = new User();
      user.set("name", "Alice");
      user.set("email", "alice@example.com");
      await user.save();

      const post = new Post();
      post.set("title", "Saved Post");
      post.set("content", "Saved content");

      await user.posts().save(post);

      expect(post.get("user_id")).toBe(user.get("id"));
      
      // Verify in database
      const posts = await user.posts().get();
      expect(posts.count()).toBe(1);
      expect(posts.first()?.get("title")).toBe("Saved Post");
    });
  });

  describe("BelongsTo Relationship", () => {
    test("should return relationship instance", () => {
      const post = new Post();
      post.set("id", 1);
      const relation = post.author();
      
      expect(relation).toBeInstanceOf(BelongsTo);
    });

    test("should load parent model", async () => {
      // Create user
      const user = new User();
      user.set("name", "John Doe");
      user.set("email", "john@example.com");
      await user.save();

      // Create post
      const post = new Post();
      post.set("user_id", user.get("id"));
      post.set("title", "Test Post");
      post.set("content", "Test content");
      await post.save();

      // Load relationship
      const author = await post.author().get();
      
      expect(author).not.toBeNull();
      expect(author?.get("name")).toBe("John Doe");
      expect(author?.get("email")).toBe("john@example.com");
    });

    test("should return null when no parent model exists", async () => {
      const post = new Post();
      post.set("user_id", 999); // Non-existent user
      post.set("title", "Orphan Post");
      post.set("content", "No author");
      await post.save();

      const author = await post.author().get();
      
      expect(author).toBeNull();
    });

    test("should associate parent model", async () => {
      // Create user
      const user = new User();
      user.set("name", "Jane Doe");
      user.set("email", "jane@example.com");
      await user.save();

      // Create post without user
      const post = new Post();
      post.set("title", "Unassigned Post");
      post.set("content", "No author yet");
      await post.save();

      // Associate user
      await post.author().associate(user);

      expect(post.get("user_id")).toBe(user.get("id"));
      
      // Verify in database
      const author = await post.author().get();
      expect(author).not.toBeNull();
      expect(author?.get("name")).toBe("Jane Doe");
    });

    test("should dissociate parent model", async () => {
      // Create user
      const user = new User();
      user.set("name", "Bob Smith");
      user.set("email", "bob@example.com");
      await user.save();

      // Create post with user
      const post = new Post();
      post.set("user_id", user.get("id"));
      post.set("title", "Test Post");
      post.set("content", "Test content");
      await post.save();

      // Dissociate user
      await post.author().dissociate();

      expect(post.get("user_id")).toBeNull();
      
      // Verify in database
      const reloaded = await Post.find(post.get("id"));
      expect(reloaded?.get("user_id")).toBeNull();
    });
  });

  describe("BelongsToMany Relationship", () => {
    test("should return relationship instance", () => {
      const user = new User();
      user.set("id", 1);
      const relation = user.roles();
      
      expect(relation).toBeInstanceOf(BelongsToMany);
    });

    test("should load related models through pivot", async () => {
      // Create user
      const user = new User();
      user.set("name", "John Doe");
      user.set("email", "john@example.com");
      await user.save();

      // Create roles
      const role1 = new Role();
      role1.set("name", "Admin");
      await role1.save();

      const role2 = new Role();
      role2.set("name", "Editor");
      await role2.save();

      // Attach roles
      await user.roles().attach([role1.get("id"), role2.get("id")]);

      // Load relationship
      const roles = await user.roles().get();
      
      expect(roles.count()).toBe(2);
      const names = roles.map((r: Role) => r.get("name")).toArray();
      expect(names).toContain("Admin");
      expect(names).toContain("Editor");
    });

    test("should return empty collection when no related models exist", async () => {
      const user = new User();
      user.set("name", "Jane Doe");
      user.set("email", "jane@example.com");
      await user.save();

      const roles = await user.roles().get();
      
      expect(roles.count()).toBe(0);
      expect(roles.isEmpty()).toBe(true);
    });

    test("should attach single model", async () => {
      const user = new User();
      user.set("name", "Bob");
      user.set("email", "bob@example.com");
      await user.save();

      const role = new Role();
      role.set("name", "Moderator");
      await role.save();

      await user.roles().attach(role.get("id"));

      const roles = await user.roles().get();
      expect(roles.count()).toBe(1);
      expect(roles.first()?.get("name")).toBe("Moderator");
    });

    test("should attach multiple models", async () => {
      const user = new User();
      user.set("name", "Alice");
      user.set("email", "alice@example.com");
      await user.save();

      const role1 = new Role();
      role1.set("name", "Admin");
      await role1.save();

      const role2 = new Role();
      role2.set("name", "User");
      await role2.save();

      await user.roles().attach([role1.get("id"), role2.get("id")]);

      const roles = await user.roles().get();
      expect(roles.count()).toBe(2);
    });

    test("should detach single model", async () => {
      const user = new User();
      user.set("name", "Charlie");
      user.set("email", "charlie@example.com");
      await user.save();

      const role1 = new Role();
      role1.set("name", "Admin");
      await role1.save();

      const role2 = new Role();
      role2.set("name", "Editor");
      await role2.save();

      await user.roles().attach([role1.get("id"), role2.get("id")]);
      await user.roles().detach(role1.get("id"));

      const roles = await user.roles().get();
      expect(roles.count()).toBe(1);
      expect(roles.first()?.get("name")).toBe("Editor");
    });

    test("should detach all models when no IDs provided", async () => {
      const user = new User();
      user.set("name", "Dave");
      user.set("email", "dave@example.com");
      await user.save();

      const role1 = new Role();
      role1.set("name", "Admin");
      await role1.save();

      const role2 = new Role();
      role2.set("name", "Editor");
      await role2.save();

      await user.roles().attach([role1.get("id"), role2.get("id")]);
      await user.roles().detach();

      const roles = await user.roles().get();
      expect(roles.count()).toBe(0);
    });

    test("should sync models (replace existing)", async () => {
      const user = new User();
      user.set("name", "Eve");
      user.set("email", "eve@example.com");
      await user.save();

      const role1 = new Role();
      role1.set("name", "Admin");
      await role1.save();

      const role2 = new Role();
      role2.set("name", "Editor");
      await role2.save();

      const role3 = new Role();
      role3.set("name", "User");
      await role3.save();

      // Initially attach roles 1 and 2
      await user.roles().attach([role1.get("id"), role2.get("id")]);

      // Sync to roles 2 and 3
      await user.roles().sync([role2.get("id"), role3.get("id")]);

      const roles = await user.roles().get();
      expect(roles.count()).toBe(2);
      const names = roles.map((r: Role) => r.get("name")).toArray();
      expect(names).not.toContain("Admin");
      expect(names).toContain("Editor");
      expect(names).toContain("User");
    });

    test("should toggle models", async () => {
      const user = new User();
      user.set("name", "Frank");
      user.set("email", "frank@example.com");
      await user.save();

      const role1 = new Role();
      role1.set("name", "Admin");
      await role1.save();

      const role2 = new Role();
      role2.set("name", "Editor");
      await role2.save();

      // Attach role1
      await user.roles().attach(role1.get("id"));

      // Toggle both (role1 should detach, role2 should attach)
      await user.roles().toggle([role1.get("id"), role2.get("id")]);

      const roles = await user.roles().get();
      expect(roles.count()).toBe(1);
      expect(roles.first()?.get("name")).toBe("Editor");

      // Toggle again (role2 should detach, role1 should attach)
      await user.roles().toggle([role1.get("id"), role2.get("id")]);

      const rolesAfter = await user.roles().get();
      expect(rolesAfter.count()).toBe(1);
      expect(rolesAfter.first()?.get("name")).toBe("Admin");
    });
  });
});
