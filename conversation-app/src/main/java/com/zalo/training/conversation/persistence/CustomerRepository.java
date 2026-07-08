package com.zalo.training.conversation.persistence;

import com.zalo.training.conversation.domain.Customer;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;

@Repository
public class CustomerRepository {

    private final JdbcClient jdbcClient;

    public CustomerRepository(JdbcClient jdbcClient) {
        this.jdbcClient = jdbcClient;
    }

    public void save(Customer customer) {
        jdbcClient.sql("""
                        INSERT INTO customers (id, external_id, display_name, created_at)
                        VALUES (:id, :externalId, :displayName, :createdAt)
                        """)
                .param("id", customer.id())
                .param("externalId", customer.externalId())
                .param("displayName", customer.displayName())
                .param("createdAt", customer.createdAt())
                .update();
    }

    public Optional<Customer> findById(UUID id) {
        return jdbcClient.sql("""
                        SELECT id, external_id, display_name, created_at
                        FROM customers
                        WHERE id = :id
                        """)
                .param("id", id)
                .query(this::map)
                .optional();
    }

    public Optional<Customer> findByExternalId(String externalId) {
        return jdbcClient.sql("""
                        SELECT id, external_id, display_name, created_at
                        FROM customers
                        WHERE external_id = :externalId
                        """)
                .param("externalId", externalId)
                .query(this::map)
                .optional();
    }

    private Customer map(ResultSet rs, int rowNum) throws SQLException {
        return new Customer(
                rs.getObject("id", UUID.class),
                rs.getString("external_id"),
                rs.getString("display_name"),
                rs.getTimestamp("created_at").toInstant()
        );
    }
}
