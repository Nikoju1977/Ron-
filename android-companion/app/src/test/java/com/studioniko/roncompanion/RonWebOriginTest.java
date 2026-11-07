package com.studioniko.roncompanion;

import org.junit.Test;
import static org.junit.Assert.*;

public class RonWebOriginTest {
    @Test public void acceptsOnlyExactPublishedPage() {
        assertTrue(RonWebOrigin.isTrustedPage("https://nikoju1977.github.io/Ron-/ron-presence.html"));
        assertFalse(RonWebOrigin.isTrustedPage("https://nikoju1977.github.io/Ron-/index.html"));
        assertFalse(RonWebOrigin.isTrustedPage("https://nikoju1977.github.io/Ron-/experimental.html"));
        assertFalse(RonWebOrigin.isTrustedPage("https://nikoju1977.github.io/Ron-/ron-presence.html?key=x"));
        assertFalse(RonWebOrigin.isTrustedPage("https://nikoju1977.github.io/Ron-/ron-presence.html#fragment"));
        assertFalse(RonWebOrigin.isTrustedPage("https://nikoju1977.github.io:8443/Ron-/ron-presence.html"));
        assertFalse(RonWebOrigin.isTrustedPage("https://nikoju1977.github.io:443/Ron-/ron-presence.html"));
        assertFalse(RonWebOrigin.isTrustedPage("http://nikoju1977.github.io/Ron-/ron-presence.html"));
        assertFalse(RonWebOrigin.isTrustedPage("https://nikoju1977.github.io.evil.example/Ron-/ron-presence.html"));
        assertFalse(RonWebOrigin.isTrustedPage("https://evil.example@localhost/Ron-/ron-presence.html"));
        assertFalse(RonWebOrigin.isTrustedPage("https://nikoju1977.github.io/Ron-/%72on-presence.html"));
        assertFalse(RonWebOrigin.isTrustedPage("https://nikoju1977.github.io/Ron-/../Ron-/ron-presence.html"));
        assertFalse(RonWebOrigin.isTrustedPage("javascript:alert(1)"));
        assertFalse(RonWebOrigin.isTrustedPage(null));
    }
}
