
ALTER TABLE users ADD COLUMN last_active DATETIME NULL DEFAULT NULL;

ALTER TABLE users ADD INDEX idx_last_active (last_active);

CREATE TABLE notification_sent_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    trigger_type VARCHAR(100) NOT NULL,
    sent_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_user_trigger_sent (user_id, trigger_type, sent_at)
);
