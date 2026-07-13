package com.zalo.training.conversation.adapter;

import org.springframework.stereotype.Component;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
public class MockActionAdapter implements ActionAdapter {

    private static final Pattern ORDER_ID_PATTERN = Pattern.compile("\\b([A-Z][0-9]{3,})\\b", Pattern.CASE_INSENSITIVE);

    @Override
    public ActionResult execute(String actionName, String input) {
        String orderId = extractOrderId(input);
        if ("ORDER_LOOKUP".equalsIgnoreCase(actionName)) {
            return new ActionResult(
                    true,
                    "Order %s is PACKING. Reply update for the latest status, ticket to create a follow-up, or done.".formatted(orderId),
                    "{\"category\":\"ORDER_STATUS\",\"orderId\":\"%s\",\"status\":\"PACKING\",\"nextQuestion\":\"update|ticket|done\"}".formatted(orderId)
            );
        }
        if ("ORDER_STATUS_UPDATE".equalsIgnoreCase(actionName)) {
            return new ActionResult(
                    true,
                    "Update: order %s moved from PACKING to SHIPPING. What follow-up category should I file: delivery delay, address change, refund, agent, or done?".formatted(orderId),
                    "{\"category\":\"ORDER_STATUS_UPDATE\",\"orderId\":\"%s\",\"previousStatus\":\"PACKING\",\"status\":\"SHIPPING\",\"nextQuestion\":\"delivery delay|address change|refund|agent|done\"}".formatted(orderId)
            );
        }
        if ("TICKET_CREATION".equalsIgnoreCase(actionName)) {
            String supportCategory = supportCategory(input);
            return new ActionResult(
                    true,
                    "Ticket TCK-1001 was created for order %s with category %s. A support specialist can follow up with the right playbook.".formatted(orderId, supportCategory),
                    "{\"category\":\"TICKET_CREATION\",\"orderId\":\"%s\",\"ticketId\":\"TCK-1001\",\"supportCategory\":\"%s\",\"status\":\"CREATED\"}".formatted(orderId, supportCategory)
            );
        }
        return new ActionResult(false, "Action khong kha dung.", "{\"error\":\"unknown_action\"}");
    }

    private String extractOrderId(String input) {
        Matcher matcher = ORDER_ID_PATTERN.matcher(input == null ? "" : input);
        if (matcher.find()) {
            return matcher.group(1).toUpperCase(Locale.ROOT);
        }
        return "UNKNOWN";
    }

    private String supportCategory(String input) {
        String normalized = input == null ? "" : input.toLowerCase(Locale.ROOT);
        if (normalized.contains("delivery") || normalized.contains("delay") || normalized.contains("shipping")) {
            return "DELIVERY_DELAY";
        }
        if (normalized.contains("address")) {
            return "ADDRESS_CHANGE";
        }
        if (normalized.contains("refund")) {
            return "REFUND_REQUEST";
        }
        return "GENERAL_SUPPORT";
    }
}
