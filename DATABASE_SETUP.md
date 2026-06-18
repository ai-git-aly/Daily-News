# Database Setup for New Features

## ✅ SQL Migrations Required

Run these commands in your Supabase SQL Editor to enable the new features:

### 1. Add Category Column

```sql
ALTER TABLE news_articles 
ADD COLUMN category TEXT DEFAULT 'News';

-- Create index for faster category queries
CREATE INDEX idx_news_articles_category ON news_articles(category);
```

### 2. Add Parent Comment Column for Nested Comments

```sql
ALTER TABLE article_comments 
ADD COLUMN parent_comment_id UUID REFERENCES article_comments(id) ON DELETE CASCADE;

-- Create index for faster nested comment queries
CREATE INDEX idx_article_comments_parent ON article_comments(parent_comment_id);
```

## 📋 Database Schema After Migration

### news_articles Table
```
Column              Type            Notes
───────────────────────────────────────────
id                  UUID            Primary Key
title               VARCHAR         Max 180 chars
content             TEXT            Now stores HTML (bold, italic, headings, etc.)
category            TEXT            NEW - Default 'News'
image_url           TEXT            Public URL from Supabase Storage
image_path          TEXT            Storage path for deletion
author_id           UUID            Reference to auth.users
author_name         VARCHAR         User's full name
created_at          TIMESTAMP       Auto-set on insert
updated_at          TIMESTAMP       Auto-set on update
```

### article_comments Table
```
Column              Type            Notes
───────────────────────────────────────────
id                  UUID            Primary Key
article_id          UUID            Foreign Key → news_articles
user_id             UUID            Foreign Key → auth.users
user_name           VARCHAR         User's name
body                TEXT            Comment text (max 800 chars)
parent_comment_id   UUID            NEW - Reference to parent comment
created_at          TIMESTAMP       Auto-set on insert
```

## 🔍 Verification

After running migrations, verify with:

```sql
-- Check news_articles columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'news_articles'
ORDER BY ordinal_position;

-- Check article_comments columns
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'article_comments'
ORDER BY ordinal_position;

-- Verify indexes
SELECT indexname FROM pg_indexes 
WHERE tablename IN ('news_articles', 'article_comments');
```

## 🛡️ Row Level Security (RLS)

Make sure your RLS policies still work with new columns:

### For news_articles:
```sql
-- Policy: Anyone can read
CREATE POLICY "Allow public read access to news_articles"
ON news_articles FOR SELECT USING (true);

-- Policy: Only admins can insert
CREATE POLICY "Allow admins to insert articles"
ON news_articles FOR INSERT 
WITH CHECK (
  auth.uid() IN (
    SELECT id FROM profiles WHERE is_admin = true
  )
);

-- Policy: Only authors/admins can update
CREATE POLICY "Allow authors and admins to update articles"
ON news_articles FOR UPDATE 
WITH CHECK (
  auth.uid() = author_id OR 
  auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
);

-- Policy: Only authors/admins can delete
CREATE POLICY "Allow authors and admins to delete articles"
ON news_articles FOR DELETE 
USING (
  auth.uid() = author_id OR 
  auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
);
```

### For article_comments:
```sql
-- Policy: Anyone can read
CREATE POLICY "Allow public read access to comments"
ON article_comments FOR SELECT USING (true);

-- Policy: Authenticated users can insert
CREATE POLICY "Allow authenticated users to insert comments"
ON article_comments FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Policy: Owners and admins can delete
CREATE POLICY "Allow owners and admins to delete comments"
ON article_comments FOR DELETE 
USING (
  auth.uid() = user_id OR 
  auth.uid() IN (SELECT id FROM profiles WHERE is_admin = true)
);
```

## ⚠️ Important Notes

1. **Existing Articles**: Will have `category = 'News'` (default)
2. **Existing Comments**: Will have `parent_comment_id = NULL` (top-level)
3. **No Data Loss**: These are additive changes, existing data preserved
4. **Cascade Delete**: Deleting a comment also deletes its replies
5. **Index Creation**: Improves performance for category/nested queries

## 🚀 Testing After Setup

1. Create article with category
2. Verify category saves to database
3. Post comment and reply to it
4. Verify `parent_comment_id` is set on reply
5. View article - both comments display correctly
6. Delete parent comment - reply should also delete

## 📞 Troubleshooting

**Error: Column already exists**
- The column may have been added - try altering
- Check existing schema first

**Error: Invalid foreign key**
- Ensure `article_comments.id` column exists first
- Try adding comment column first, then reference it

**Comments not displaying nested**
- Check that `parent_comment_id` was added to table
- Verify JavaScript is reading the new column
- Check browser console for JavaScript errors
