-- Training Categories
-- CREATE TABLE IF NOT EXISTS training_categories (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     name VARCHAR(100) UNIQUE NOT NULL,
--     description TEXT,
--     icon VARCHAR(50)
-- );

-- Trainings (Main training programs)
CREATE TABLE IF NOT EXISTS trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trainer_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,

    thumbnail TEXT,

    agora_channel_name VARCHAR(255) UNIQUE NOT NULL,

    scheduled_at TIMESTAMP NOT NULL,

    duration_minutes INTEGER NOT NULL,

    max_participants INTEGER,

    status VARCHAR(50) DEFAULT 'UPCOMING',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    started_at TIMESTAMP,
    ended_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS training_materials (
   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
   vendor_id UUID NOT NULL,
   title VARCHAR(200) NOT NULL,
   description TEXT,
   file_path TEXT NOT NULL,
   file_size BIGINT,
   file_type VARCHAR(100),
   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
   category TEXT NOT NULL
);


-- Live Sessions
-- CREATE TABLE IF NOT EXISTS live_sessions (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
--     vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
--     title VARCHAR(255) NOT NULL,
--     description TEXT,
--     scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
--     scheduled_end TIMESTAMP WITH TIME ZONE,
--     max_participants INTEGER,
--     status VARCHAR(50) DEFAULT 'scheduled',
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Recorded Videos
-- CREATE TABLE IF NOT EXISTS recorded_videos (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
--     vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
--     title VARCHAR(200) NOT NULL,
--     description TEXT,
--     video_url VARCHAR(500) NOT NULL, -- Cloudinary URL
--     thumbnail_url VARCHAR(500),
--     duration INTEGER, -- in seconds
--     file_size BIGINT, -- in bytes
--     is_active BOOLEAN DEFAULT true,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Enrollments (Users enrolled in trainings) should be farmers
CREATE TABLE IF NOT EXISTS training_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    training_id UUID NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,

    farmer_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

    attended BOOLEAN DEFAULT FALSE,

    enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(training_id, farmer_id)
);

-- Live Session Participants
-- CREATE TABLE IF NOT EXISTS live_session_participants (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
--     farmer_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
--     joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     left_at TIMESTAMP WITH TIME ZONE,
--     is_active BOOLEAN DEFAULT false, -- currently in session
--     UNIQUE(session_id, farmer_id)
-- );

-- Video Progress Tracking
-- CREATE TABLE IF NOT EXISTS video_progress (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     video_id UUID NOT NULL REFERENCES recorded_videos(id) ON DELETE CASCADE,
--     farmer_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
--     watched_seconds INTEGER DEFAULT 0,
--     total_seconds INTEGER DEFAULT 0,
--     is_completed BOOLEAN DEFAULT false,
--     last_watched_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
--     UNIQUE(video_id, farmer_id)
-- );

-- Live Chat Messages
-- CREATE TABLE IF NOT EXISTS live_chat_messages (
--     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--     session_id UUID NOT NULL REFERENCES live_sessions(id) ON DELETE CASCADE,
--     sender_id UUID NOT NULL, -- Can be vendor or buyer
--     sender_type VARCHAR(10) NOT NULL CHECK (sender_type IN ('trainer', 'farmer')),
--     message TEXT NOT NULL,
--     created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
-- );

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_trainings_trainer_id ON trainings(trainer_id);
-- CREATE INDEX IF NOT EXISTS idx_trainings_is_active ON trainings(is_active);
CREATE INDEX IF NOT EXISTS idx_training_material_id ON training_materials(id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_training_id ON training_enrollments(training_id);
CREATE INDEX IF NOT EXISTS idx_training_enrollments_farmer_id ON training_enrollments(farmer_id);

-- Insert default training categories
-- INSERT INTO training_categories (name, description, icon) VALUES
-- ('Crop Management', 'Learn about crop cultivation, pest control, and harvesting techniques', 'leaf'),
-- ('Livestock Farming', 'Animal husbandry, breeding, and livestock management', 'heart'),
-- ('Equipment Operation', 'Farm machinery operation and maintenance', 'wrench'),
-- ('Business Skills', 'Farm management, marketing, and financial planning', 'briefcase'),
-- ('Sustainability', 'Organic farming, conservation, and sustainable practices', 'globe')
-- ON CONFLICT (name) DO NOTHING;
