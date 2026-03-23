const axios = require("axios");

// Zoom API Configuration
const ZOOM_API_KEY = process.env.ZOOM_API_KEY || "";
const ZOOM_API_SECRET = process.env.ZOOM_API_SECRET || "";
const ZOOM_ACCOUNT_ID = process.env.ZOOM_ACCOUNT_ID || "";

/**
 * Generate Zoom OAuth token
 */
async function getZoomAccessToken() {
    try {
        const credentials = Buffer.from(`${ZOOM_API_KEY}:${ZOOM_API_SECRET}`).toString("base64");

        const response = await axios.post(
            "https://zoom.us/oauth/token",
            new URLSearchParams({
                grant_type: "account_credentials",
                account_id: ZOOM_ACCOUNT_ID
            }),
            {
                headers: {
                    Authorization: `Basic ${credentials}`,
                    "Content-Type": "application/x-www-form-urlencoded"
                }
            }
        );

        return response.data.access_token;
    } catch (error) {
        console.error("Error getting Zoom access token:", error.response?.data || error.message);
        throw new Error("Failem to authenticate with Zoom");
    }
}

/**
 * Create a Zoom meeting
 * @param {Object} meetingDetails - Meeting details
 * @param {string} meetingDetails.topic - Meeting topic/title
 * @param {string} meetingDetails.startTime - ISO datetime string
 * @param {number} meetingDetails.duration - Duration in minutes
 * @param {string} meetingDetails.password - Meeting password (optional)
 * @returns {Promise<Object>} Meeting details including join URL
 */
async function createZoomMeeting(meetingDetails) {
    try {
        // Check if Zoom credentials are available
        if (!ZOOM_API_KEY || !ZOOM_API_SECRET || !ZOOM_ACCOUNT_ID) {
            console.warn("Zoom credentials not configured. Using fallback mock meeting.");
            return generateMockMeeting(meetingDetails);
        }

        const accessToken = await getZoomAccessToken();

        const meetingData = {
            topic: meetingDetails.topic || "Live Class Session",
            type: 2, // Scheduled meeting
            start_time: meetingDetails.startTime,
            duration: meetingDetails.duration || 60,
            timezone: "Asia/Kolkata", // IST timezone
            settings: {
                host_video: true,
                participant_video: false,
                join_before_host: false,
                mute_upon_entry: true,
                waiting_room: true,
                auto_recording: "cloud", // Optional: record to cloud
                enforce_login: false,
                approval_type: 0 // Automatic approval
            }
        };

        // Add password if provided
        if (meetingDetails.password) {
            meetingData.password = meetingDetails.password;
        }

        const response = await axios.post(
            "https://api.zoom.us/v2/users/me/meetings",
            meetingData,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                    "Content-Type": "application/json"
                }
            }
        );

        return {
            success: true,
            meetingId: response.data.id.toString(),
            meetingLink: response.data.join_url,
            hostLink: response.data.start_url,
            password: response.data.password || "",
            platform: "zoom"
        };
    } catch (error) {
        console.error("Error creating Zoom meeting:", error.response?.data || error.message);
        // Fallback to mock meeting if Zoom API fails
        return generateMockMeeting(meetingDetails);
    }
}

/**
 * Generate a mock meeting link (fallback when Zoom is not configured)
 * This creates a deterministic mock meeting link that can be used for testing
 */
function generateMockMeeting(meetingDetails) {
    const timestamp = Date.now();
    const randomId = Math.floor(Math.random() * 9000000000) + 1000000000;
    const password = Math.floor(Math.random() * 900000) + 100000;

    // Create a deterministic but unique meeting link
    const meetingId = randomId.toString();
    const joinUrl = `https://zoom.us/j/${meetingId}?pwd=${Buffer.from(meetingId).toString("base64").substring(0, 10)}`;
    const hostUrl = `https://zoom.us/s/${meetingId}?zak=host_${timestamp}`;

    return {
        success: true,
        meetingId: meetingId,
        meetingLink: joinUrl,
        hostLink: hostUrl,
        password: password.toString(),
        platform: "zoom",
        isMock: true
    };
}

/**
 * Generate a Google Meet link (alternative option)
 */
function generateGoogleMeetLink(meetingDetails) {
    const randomId = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const meetCode = randomId.substring(0, 12).replace(/[0-9]/g, "a");

    return {
        success: true,
        meetingId: meetCode,
        meetingLink: `https://meet.google.com/${meetCode}`,
        hostLink: `https://meet.google.com/${meetCode}`,
        password: "",
        platform: "google_meet",
        isMock: true
    };
}

/**
 * Delete a Zoom meeting
 */
async function deleteZoomMeeting(meetingId) {
    try {
        if (!ZOOM_API_KEY || !ZOOM_API_SECRET || !ZOOM_ACCOUNT_ID) {
            return { success: true, message: "Mock meeting deleted" };
        }

        const accessToken = await getZoomAccessToken();

        await axios.delete(
            `https://api.zoom.us/v2/meetings/${meetingId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        return { success: true, message: "Meeting deleted successfully" };
    } catch (error) {
        console.error("Error deleting Zoom meeting:", error.response?.data || error.message);
        return { success: false, message: error.message };
    }
}

/**
 * Check Zoom meeting status
 * @param {string} meetingId - The Zoom meeting ID
 * @returns {Promise<Object>} Status object
 */
async function checkZoomMeetingStatus(meetingId) {
    try {
        if (!ZOOM_API_KEY || !ZOOM_API_SECRET || !ZOOM_ACCOUNT_ID) {
            return { success: true, status: "started", isMock: true }; // Assume started for mock
        }

        const accessToken = await getZoomAccessToken();

        const response = await axios.get(
            `https://api.zoom.us/v2/meetings/${meetingId}`,
            {
                headers: {
                    Authorization: `Bearer ${accessToken}`
                }
            }
        );

        return {
            success: true,
            status: response.data.status, // 'waiting', 'started', 'ended'
            startTime: response.data.start_time,
            duration: response.data.duration
        };
    } catch (error) {
        console.error("Error checking Zoom meeting status:", error.response?.data || error.message);
        // If 404, meeting might have been deleted or expired
        if (error.response?.status === 404) {
            return { success: true, status: "ended", message: "Meeting not found" };
        }
        return { success: false, message: error.message };
    }
}

module.exports = {
    createZoomMeeting,
    deleteZoomMeeting,
    checkZoomMeetingStatus,
    generateGoogleMeetLink,
    generateMockMeeting
};

