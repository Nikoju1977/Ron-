package com.studioniko.roncompanion;

import org.junit.Test;
import static org.junit.Assert.*;

public class RonCycleTest {
    @Test public void rejectsInvalidIntervalsWithoutFallbackOrOverflow() {
        assertEquals(60_000L,RonCycle.validIntervalMs(1));
        assertEquals(3_600_000L,RonCycle.validIntervalMs(60));
        assertEquals(0L,RonCycle.validIntervalMs(0));
        assertEquals(0L,RonCycle.validIntervalMs(61));
        assertEquals(0L,RonCycle.validIntervalMs(Long.MAX_VALUE));
        assertEquals(0L,RonCycle.validIntervalMs(-5));
    }
    @Test public void onlyPrivateIpv4WithExplicitPortAllowed() {
        assertTrue(RonCycle.isAllowedEndpoint("http://192.168.1.20:11434/v1"));
        assertTrue(RonCycle.isAllowedEndpoint("http://10.2.3.4:1234/v1"));
        assertTrue(RonCycle.isAllowedEndpoint("http://172.16.0.1:8000"));
        assertTrue(RonCycle.isAllowedEndpoint("http://127.0.0.1:8080/v1"));
        assertFalse(RonCycle.isAllowedEndpoint("https://api.mistral.ai/v1"));
        assertFalse(RonCycle.isAllowedEndpoint("http://8.8.8.8:80/v1"));
        assertFalse(RonCycle.isAllowedEndpoint("http://169.254.10.2:8000/v1"));
        assertFalse(RonCycle.isAllowedEndpoint("http://localhost:11434/v1"));
        assertFalse(RonCycle.isAllowedEndpoint("http://example.com:8080/v1"));
        assertFalse(RonCycle.isAllowedEndpoint("http://192.168.1.20:11434/redirect"));
        assertFalse(RonCycle.isAllowedEndpoint("http://192.168.1.20:11434/v1?secret=yes"));
        assertFalse(RonCycle.isAllowedEndpoint("http://192.168.1.20:11434/v1#fragment"));
        assertFalse(RonCycle.isAllowedEndpoint("http://192.168.1.20:11434@evil.com/v1"));
        assertFalse(RonCycle.isAllowedEndpoint("http://256.256.256.256:8000/v1"));
    }
}
