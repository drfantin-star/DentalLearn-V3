ALTER TABLE user_profiles
ADD COLUMN ordre_inscription_date date;

COMMENT ON COLUMN user_profiles.ordre_inscription_date IS
'Date d''inscription à l''Ordre des chirurgiens-dentistes. Sert à calculer la période de certification.';
