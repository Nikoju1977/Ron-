package com.studioniko.roncompanion;

import java.net.URI;

/** The native mission bridge may trust exactly one published application page. */
final class RonWebOrigin {
    private RonWebOrigin() {}
    static boolean isTrustedPage(String value) {
        try {
            URI uri=new URI(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                && "nikoju1977.github.io".equalsIgnoreCase(uri.getHost())
                && uri.getRawUserInfo()==null
                && uri.getPort()==-1
                && uri.getRawQuery()==null
                && uri.getRawFragment()==null
                && "/Ron-/ron-presence.html".equals(uri.getRawPath());
        } catch (Exception error) {
            return false;
        }
    }
}
